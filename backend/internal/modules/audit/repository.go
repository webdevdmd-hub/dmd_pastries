package audit

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, log *AuditLog) error {
	return tx.Create(log).Error
}

type ActivityInput struct {
	BusinessID   string
	ActorUserID  string
	TargetUserID *string
	EventType    string
	EntityType   string
	EntityID     string
	Summary      string
	Metadata     map[string]interface{}
	IPAddress    string
	UserAgent    string
}

func (r *Repository) CreateActivity(tx *gorm.DB, input ActivityInput) error {
	metadata := "{}"
	if input.Metadata != nil {
		raw, err := json.Marshal(input.Metadata)
		if err != nil {
			return err
		}
		metadata = string(raw)
	}

	targetUserID := input.TargetUserID
	if targetUserID != nil && *targetUserID == "" {
		targetUserID = nil
	}

	return tx.Create(&AuditLog{
		ID:           utils.NewUUID(),
		BusinessID:   input.BusinessID,
		UserID:       input.ActorUserID,
		ModuleName:   input.EntityType,
		ActionType:   input.EventType,
		ReferenceID:  input.EntityID,
		IPAddress:    input.IPAddress,
		UserAgent:    input.UserAgent,
		ActorUserID:  input.ActorUserID,
		TargetUserID: targetUserID,
		EventType:    input.EventType,
		EntityType:   input.EntityType,
		EntityID:     input.EntityID,
		Summary:      input.Summary,
		Metadata:     metadata,
	}).Error
}

func (r *Repository) ListByBusinessAndUser(businessID, userID string, limit int) ([]AuditLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var logs []AuditLog
	err := r.db.
		Where("business_id = ? AND (user_id = ? OR reference_id = ?)", businessID, userID, userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

func (r *Repository) ListActivity(businessID, entityType, targetUserID, cursor string, limit int) ([]AuditLog, string, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := r.db.Where("business_id = ?", businessID)
	if entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if targetUserID != "" {
		query = query.Where("target_user_id = ? OR entity_id = ?", targetUserID, targetUserID)
	}
	if cursor != "" {
		createdAt, id, err := decodeCursor(cursor)
		if err == nil {
			query = query.Where("(created_at < ? OR (created_at = ? AND id < ?))", createdAt, createdAt, id)
		}
	}

	var logs []AuditLog
	err := query.Order("created_at DESC, id DESC").Limit(limit + 1).Find(&logs).Error
	if err != nil {
		return nil, "", err
	}

	nextCursor := ""
	if len(logs) > limit {
		next := logs[limit-1]
		nextCursor = encodeCursor(next.CreatedAt, next.ID)
		logs = logs[:limit]
	}

	return logs, nextCursor, nil
}

func (r *Repository) BuildActivityResponses(businessID string, logs []AuditLog) ([]ActivityLogResponse, error) {
	userDisplays, err := r.loadActivityUserDisplays(businessID, logs)
	if err != nil {
		return nil, err
	}

	items := make([]ActivityLogResponse, 0, len(logs))
	for _, log := range logs {
		actorID := firstNonEmpty(log.ActorUserID, log.UserID)
		var actor *ActivityUserDisplay
		if display, ok := userDisplays[actorID]; ok {
			actor = &display
		}

		var target *ActivityUserDisplay
		if log.TargetUserID != nil {
			if display, ok := userDisplays[*log.TargetUserID]; ok {
				target = &display
			}
		}

		recordLabel := r.resolveRecordLabel(businessID, log)
		items = append(items, ToActivityLogResponseWithDisplay(log, actor, target, recordLabel))
	}

	return items, nil
}

func (r *Repository) loadActivityUserDisplays(businessID string, logs []AuditLog) (map[string]ActivityUserDisplay, error) {
	ids := make([]string, 0, len(logs)*2)
	seen := map[string]struct{}{}
	addID := func(id string) {
		id = strings.TrimSpace(id)
		if id == "" {
			return
		}
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	for _, log := range logs {
		addID(firstNonEmpty(log.ActorUserID, log.UserID))
		if log.TargetUserID != nil {
			addID(*log.TargetUserID)
		}
	}

	if len(ids) == 0 {
		return map[string]ActivityUserDisplay{}, nil
	}

	var rows []ActivityUserDisplay
	if err := r.db.Unscoped().
		Table("users").
		Select("id, full_name, email").
		Where("business_id = ? AND id IN ?", businessID, ids).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	displays := make(map[string]ActivityUserDisplay, len(rows))
	for _, row := range rows {
		displays[row.ID] = row
	}
	return displays, nil
}

func (r *Repository) resolveRecordLabel(businessID string, log AuditLog) string {
	metadata := map[string]interface{}{}
	if log.Metadata != "" {
		_ = json.Unmarshal([]byte(log.Metadata), &metadata)
	}

	if label := metadataRecordLabel(metadata); label != "" {
		return label
	}

	entityID := firstNonEmpty(log.EntityID, log.ReferenceID)
	if entityID == "" {
		return fallbackRecordLabel(entityID, log.Summary, metadata)
	}

	if label := r.lookupRecordLabel(businessID, normalizeAuditKey(firstNonEmpty(log.EntityType, log.ModuleName)), entityID); label != "" {
		return label
	}

	return fallbackRecordLabel(entityID, log.Summary, metadata)
}

func (r *Repository) lookupRecordLabel(businessID, entityType, entityID string) string {
	switch entityType {
	case "user", "users":
		var row struct{ FullName, Email string }
		_ = r.db.Unscoped().Table("users").Select("full_name, email").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.FullName, row.Email)
	case "role", "roles":
		var row struct{ RoleName string }
		_ = r.db.Unscoped().Table("roles").Select("role_name").Where("(business_id = ? OR business_id IS NULL) AND id = ?", businessID, entityID).Scan(&row).Error
		return row.RoleName
	case "branch", "branches":
		var row struct{ BranchName, Name, Code string }
		_ = r.db.Unscoped().Table("branches").Select("branch_name, name, code").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(firstNonEmpty(row.BranchName, row.Name), row.Code)
	case "business":
		var row struct{ BusinessName string }
		_ = r.db.Table("businesses").Select("business_name").Where("id = ?", entityID).Scan(&row).Error
		return row.BusinessName
	case "settings", "company_settings":
		var row struct{ BusinessDisplayName string }
		_ = r.db.Unscoped().Table("company_settings").Select("business_display_name").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.BusinessDisplayName, "Company settings")
	case "tax_rate", "tax_rates":
		var row struct{ TaxName string }
		_ = r.db.Unscoped().Table("tax_rates").Select("tax_name").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return row.TaxName
	case "payment_method", "payment_methods":
		var row struct{ MethodName string }
		_ = r.db.Unscoped().Table("payment_methods").Select("method_name").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return row.MethodName
	case "product", "products":
		var row struct{ ProductName, SKU, ProductCode string }
		_ = r.db.Unscoped().Table("products").Select("product_name, sku, product_code").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.ProductName, firstNonEmpty(row.SKU, row.ProductCode))
	case "product_variant", "product_variants":
		var row struct{ ProductName, VariantName, SKU string }
		_ = r.db.Unscoped().Table("product_variants AS pv").
			Select("COALESCE(p.product_name, '') AS product_name, pv.variant_name, pv.sku").
			Joins("LEFT JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id").
			Where("pv.business_id = ? AND pv.id = ?", businessID, entityID).
			Scan(&row).Error
		return joinLabel(firstNonEmpty(strings.TrimSpace(row.ProductName+" - "+row.VariantName), row.VariantName), row.SKU)
	case "ingredient", "ingredients":
		var row struct{ IngredientName, IngredientCode string }
		_ = r.db.Unscoped().Table("ingredients").Select("ingredient_name, ingredient_code").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.IngredientName, row.IngredientCode)
	case "packaging", "packaging_item", "packaging_items":
		var row struct{ PackagingName, PackagingCode string }
		_ = r.db.Unscoped().Table("packaging_items").Select("packaging_name, packaging_code").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.PackagingName, row.PackagingCode)
	case "stock_movement", "stock_movements":
		var row struct{ ReferenceNumber, MovementType string }
		_ = r.db.Unscoped().Table("stock_movements").Select("reference_number, movement_type").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.ReferenceNumber, humanizeAuditWords(row.MovementType))
	case "stock_transfer", "stock_transfers":
		var row struct{ TransferNumber string }
		_ = r.db.Unscoped().Table("stock_transfers").Select("transfer_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return row.TransferNumber
	case "pos", "sale", "sales":
		var row struct{ SaleNumber, ExternalOrderNumber string }
		_ = r.db.Unscoped().Table("sales").Select("sale_number, external_order_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.SaleNumber, row.ExternalOrderNumber)
	case "bakery_order", "bakery_orders":
		var row struct{ OrderNumber, ExternalOrderNumber, CustomerNameSnapshot string }
		_ = r.db.Unscoped().Table("bakery_orders").Select("order_number, external_order_number, customer_name_snapshot").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(firstNonEmpty(row.OrderNumber, row.ExternalOrderNumber), row.CustomerNameSnapshot)
	case "expense", "expenses":
		var row struct{ ExpenseNumber, ReferenceNumber string }
		_ = r.db.Unscoped().Table("expenses").Select("expense_number, reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.ExpenseNumber, row.ReferenceNumber)
	case "purchase_order", "purchase_orders":
		var row struct{ PurchaseOrderNumber, SupplierName string }
		_ = r.db.Unscoped().Table("purchase_orders AS po").
			Select("po.purchase_order_number, COALESCE(s.supplier_name, '') AS supplier_name").
			Joins("LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.business_id = po.business_id").
			Where("po.business_id = ? AND po.id = ?", businessID, entityID).
			Scan(&row).Error
		return joinLabel(row.PurchaseOrderNumber, row.SupplierName)
	case "purchase_invoice", "purchase_invoices":
		var row struct{ InvoiceNumber, SupplierBillNumber string }
		_ = r.db.Unscoped().Table("purchase_invoices").Select("invoice_number, supplier_bill_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.InvoiceNumber, row.SupplierBillNumber)
	case "purchase_receipt", "purchase_receipts":
		var row struct{ ReceiptNumber string }
		_ = r.db.Unscoped().Table("purchase_receipts").Select("receipt_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return row.ReceiptNumber
	case "purchase_return", "purchase_returns":
		var row struct{ ReturnNumber string }
		_ = r.db.Unscoped().Table("purchase_returns").Select("return_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return row.ReturnNumber
	case "supplier_payment", "supplier_payments":
		var row struct {
			ReferenceNumber           string
			PaymentMethodNameSnapshot string
			SupplierName              string
		}
		_ = r.db.Unscoped().Table("supplier_payments AS sp").
			Select("sp.reference_number, sp.payment_method_name_snapshot, COALESCE(s.supplier_name, '') AS supplier_name").
			Joins("LEFT JOIN suppliers s ON s.id = sp.supplier_id AND s.business_id = sp.business_id").
			Where("sp.business_id = ? AND sp.id = ?", businessID, entityID).
			Scan(&row).Error
		return joinLabel(firstNonEmpty(row.ReferenceNumber, row.PaymentMethodNameSnapshot), row.SupplierName)
	case "supplier", "suppliers":
		var row struct{ SupplierName, SupplierCode string }
		_ = r.db.Unscoped().Table("suppliers").Select("supplier_name, supplier_code").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.SupplierName, row.SupplierCode)
	case "customer", "customers":
		var row struct{ FullName, CustomerCode, Email string }
		_ = r.db.Unscoped().Table("customers").Select("full_name, customer_code, email").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(firstNonEmpty(row.FullName, row.Email), row.CustomerCode)
	case "recipe", "recipes":
		var row struct{ RecipeName, RecipeCode string }
		_ = r.db.Unscoped().Table("recipes").Select("recipe_name, recipe_code").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.RecipeName, row.RecipeCode)
	case "manufacturing", "production_batch", "production_batches":
		var row struct{ ProductionBatchNumber string }
		_ = r.db.Unscoped().Table("production_batches").Select("production_batch_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return row.ProductionBatchNumber
	case "chart_account", "chart_accounts":
		var row struct{ AccountCode, AccountName string }
		_ = r.db.Unscoped().Table("chart_of_accounts").Select("account_code, account_name").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.AccountName, row.AccountCode)
	case "payment_account", "payment_accounts":
		var row struct{ AccountName, AccountType string }
		_ = r.db.Unscoped().Table("payment_accounts").Select("account_name, account_type").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return joinLabel(row.AccountName, humanizeAuditWords(row.AccountType))
	case "journal_entry", "journal_entries":
		var row struct{ EntryNumber, ReferenceNumber string }
		_ = r.db.Unscoped().Table("journal_entries").Select("entry_number, reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		return firstNonEmpty(row.EntryNumber, row.ReferenceNumber)
	default:
		return ""
	}
}

func joinLabel(primary, secondary string) string {
	primary = strings.TrimSpace(primary)
	secondary = strings.TrimSpace(secondary)
	if primary == "" {
		return secondary
	}
	if secondary == "" || secondary == primary {
		return primary
	}
	return primary + " (" + secondary + ")"
}

func encodeCursor(createdAt time.Time, id string) string {
	payload := createdAt.UTC().Format(time.RFC3339Nano) + "|" + id
	return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func decodeCursor(cursor string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", err
	}
	var timestamp string
	var id string
	for index, char := range string(raw) {
		if char == '|' {
			timestamp = string(raw[:index])
			id = string(raw[index+1:])
			break
		}
	}
	createdAt, err := time.Parse(time.RFC3339Nano, timestamp)
	return createdAt, id, err
}
