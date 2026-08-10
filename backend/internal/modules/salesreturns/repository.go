package salesreturns

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/charges"
	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

type saleRow struct {
	ID                   string
	BusinessID           string
	BranchID             string
	BranchName           string
	CustomerID           *string
	CustomerName         string
	SaleNumber           string
	TotalAmount          float64
	PaidAmount           float64
	ChangeAmount         float64
	PaymentStatus        string
	SaleStatus           string
	ReturnStatus         string
	ReturnedAmount       float64
	ReturnRefundedAmount float64
}

type saleItemRow struct {
	ID                        string
	BusinessID                string
	SaleID                    string
	ProductID                 string
	ProductVariantID          *string
	ProductNameSnapshot       string
	VariantNameSnapshot       string
	SKUSnapshot               string
	Quantity                  float64
	UnitPrice                 float64
	DiscountAmount            float64
	TaxRateID                 *string
	TaxRateNameSnapshot       string
	TaxRatePercentageSnapshot float64
	TaxAmount                 float64
	LineSubtotal              float64
	LineTotal                 float64
}

type paymentMethodRow struct {
	ID                      string
	MethodName              string
	MethodType              string
	RequiresReference       bool
	DefaultPaymentAccountID *string
	PaymentAccountBranchID  *string
	PaymentAccountName      string
	ChartAccountID          string
}

type productInventoryStockRow struct {
	ProductID         string
	ProductName       string
	ProductVariantID  *string
	VariantName       string
	IsStockTracked    bool
	InventoryItemID   *string
	AvailableQuantity float64
}

func (r *Repository) Create(tx *gorm.DB, salesReturn *SalesReturn, items []SalesReturnItem) error {
	if err := tx.Create(salesReturn).Error; err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}
	return tx.Create(&items).Error
}

func (r *Repository) ReplaceItems(tx *gorm.DB, businessID, salesReturnID string, items []SalesReturnItem) error {
	if err := tx.Model(&SalesReturnItem{}).
		Where("business_id = ? AND sales_return_id = ? AND deleted_at IS NULL", businessID, salesReturnID).
		Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}
	return tx.Create(&items).Error
}

func (r *Repository) Update(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&SalesReturn{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpdateItem(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&SalesReturnItem{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindByID(tx *gorm.DB, businessID, id string) (*SalesReturn, error) {
	db := r.db
	if tx != nil {
		db = tx
	}
	var salesReturn SalesReturn
	err := db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Take(&salesReturn).Error
	return &salesReturn, err
}

func (r *Repository) FindForUpdate(tx *gorm.DB, businessID, id string) (*SalesReturn, error) {
	var salesReturn SalesReturn
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).
		Take(&salesReturn).Error
	return &salesReturn, err
}

func (r *Repository) List(businessID string, query SalesReturnListQuery) ([]SalesReturn, int64, error) {
	db := r.db.Model(&SalesReturn{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyListFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var rows []SalesReturn
	err := db.Order("return_date " + sortOrder + ", return_number " + sortOrder).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) Items(tx *gorm.DB, businessID, salesReturnID string) ([]SalesReturnItem, error) {
	db := r.db
	if tx != nil {
		db = tx
	}
	var items []SalesReturnItem
	err := db.Where("business_id = ? AND sales_return_id = ? AND deleted_at IS NULL", businessID, salesReturnID).
		Order("created_at ASC, id ASC").Find(&items).Error
	return items, err
}

func (r *Repository) FindSaleForUpdate(tx *gorm.DB, businessID, saleID string) (*saleRow, error) {
	var row saleRow
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Table("sales s").
		Select(`
			s.id,
			s.business_id,
			s.branch_id,
			COALESCE(b.branch_name, '') AS branch_name,
			s.customer_id,
			COALESCE(c.full_name, '') AS customer_name,
			s.sale_number,
			s.total_amount,
			s.paid_amount,
			s.change_amount,
			s.payment_status,
			s.sale_status,
			COALESCE(s.return_status, 'none') AS return_status,
			COALESCE(s.returned_amount, 0) AS returned_amount,
			COALESCE(s.return_refunded_amount, 0) AS return_refunded_amount
		`).
		Joins("LEFT JOIN branches b ON b.id = s.branch_id AND b.business_id = s.business_id").
		Joins("LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id").
		Where("s.business_id = ? AND s.id = ? AND s.deleted_at IS NULL", businessID, saleID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) FindSale(tx *gorm.DB, businessID, saleID string) (*saleRow, error) {
	db := r.db
	if tx != nil {
		db = tx
	}
	var row saleRow
	err := db.Table("sales s").
		Select(`
			s.id,
			s.business_id,
			s.branch_id,
			COALESCE(b.branch_name, '') AS branch_name,
			s.customer_id,
			COALESCE(c.full_name, '') AS customer_name,
			s.sale_number,
			s.total_amount,
			s.paid_amount,
			s.change_amount,
			s.payment_status,
			s.sale_status,
			COALESCE(s.return_status, 'none') AS return_status,
			COALESCE(s.returned_amount, 0) AS returned_amount,
			COALESCE(s.return_refunded_amount, 0) AS return_refunded_amount
		`).
		Joins("LEFT JOIN branches b ON b.id = s.branch_id AND b.business_id = s.business_id").
		Joins("LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id").
		Where("s.business_id = ? AND s.id = ? AND s.deleted_at IS NULL", businessID, saleID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) FindSaleItem(tx *gorm.DB, businessID, saleID, saleItemID string) (*saleItemRow, error) {
	var row saleItemRow
	err := tx.Table("sale_items").
		Where("business_id = ? AND sale_id = ? AND id = ?", businessID, saleID, saleItemID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) ListSaleItems(tx *gorm.DB, businessID, saleID string) ([]saleItemRow, error) {
	db := r.db
	if tx != nil {
		db = tx
	}
	var rows []saleItemRow
	err := db.Table("sale_items").
		Where("business_id = ? AND sale_id = ?", businessID, saleID).
		Order("created_at ASC, id ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) PostedReturnedQuantity(tx *gorm.DB, businessID, saleItemID, excludeReturnID string) (float64, error) {
	var total float64
	query := tx.Table("sales_return_items sri").
		Select("COALESCE(SUM(sri.quantity), 0)").
		Joins("JOIN sales_returns sr ON sr.id = sri.sales_return_id AND sr.business_id = sri.business_id").
		Where("sri.business_id = ? AND sri.sale_item_id = ? AND sri.deleted_at IS NULL AND sr.deleted_at IS NULL AND sr.status = ?", businessID, saleItemID, "posted")
	if strings.TrimSpace(excludeReturnID) != "" {
		query = query.Where("sr.id <> ?", excludeReturnID)
	}
	err := query.Scan(&total).Error
	return total, err
}

func (r *Repository) AvailableRefundableAmount(tx *gorm.DB, businessID, saleID string) (float64, error) {
	var collected float64
	if err := tx.Table("sale_payments").
		Select("COALESCE(SUM(amount), 0)").
		Where("business_id = ? AND sale_id = ? AND payment_status IN ? AND deleted_at IS NULL", businessID, saleID, []string{"completed", "partially_refunded", "refunded"}).
		Scan(&collected).Error; err != nil {
		return 0, err
	}
	var refunded float64
	if err := tx.Table("payment_refunds").
		Select("COALESCE(SUM(refund_amount), 0)").
		Where("business_id = ? AND sale_id = ? AND refund_status = ? AND deleted_at IS NULL", businessID, saleID, "completed").
		Scan(&refunded).Error; err != nil {
		return 0, err
	}
	return collected - refunded, nil
}

func (r *Repository) FindPaymentMethod(tx *gorm.DB, businessID, methodID string) (*paymentMethodRow, error) {
	var row paymentMethodRow
	err := tx.Table("payment_methods pm").
		Select(`
			pm.id,
			pm.method_name,
			pm.method_type,
			pm.requires_reference,
			pm.default_payment_account_id,
			pa.branch_id AS payment_account_branch_id,
			COALESCE(pa.account_name, '') AS payment_account_name,
			COALESCE(pa.chart_account_id::text, '') AS chart_account_id
		`).
		Joins("LEFT JOIN payment_accounts pa ON pa.id = pm.default_payment_account_id AND pa.business_id = pm.business_id AND pa.status = 'active' AND pa.deleted_at IS NULL").
		Where("pm.business_id = ? AND pm.id = ? AND pm.status = ? AND pm.deleted_at IS NULL", businessID, methodID, "active").
		Take(&row).Error
	return &row, err
}

func (r *Repository) FindProductInventoryForReturn(tx *gorm.DB, businessID, branchID, productID string, variantID *string) (*productInventoryStockRow, error) {
	var row productInventoryStockRow
	query := tx.Table("products p").
		Select("p.id AS product_id, p.product_name, p.is_stock_tracked, ii.id AS inventory_item_id, COALESCE(ii.available_quantity, 0) AS available_quantity").
		Where("p.id = ? AND p.business_id = ? AND p.branch_id = ? AND p.deleted_at IS NULL", productID, businessID, branchID)
	if variantID != nil && strings.TrimSpace(*variantID) != "" {
		query = query.Select("p.id AS product_id, p.product_name, pv.id AS product_variant_id, pv.variant_name, p.is_stock_tracked, ii.id AS inventory_item_id, COALESCE(ii.available_quantity, 0) AS available_quantity").
			Joins("JOIN product_variants pv ON pv.product_id = p.id AND pv.business_id = p.business_id AND pv.id = ? AND pv.deleted_at IS NULL", *variantID).
			Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL", branchID, "product_variant")
	} else {
		query = query.Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.product_variant_id IS NULL AND ii.deleted_at IS NULL", branchID, "product")
	}
	err := query.Take(&row).Error
	return &row, err
}

func (r *Repository) RefreshSaleReturnTotals(tx *gorm.DB, businessID, saleID string) error {
	var totalReturned, totalRefunded float64
	if err := tx.Table("sales_returns").
		Select("COALESCE(SUM(return_total), 0)").
		Where("business_id = ? AND sale_id = ? AND status = ? AND deleted_at IS NULL", businessID, saleID, "posted").
		Scan(&totalReturned).Error; err != nil {
		return err
	}
	if err := tx.Table("sales_returns").
		Select("COALESCE(SUM(refund_amount), 0)").
		Where("business_id = ? AND sale_id = ? AND status = ? AND deleted_at IS NULL", businessID, saleID, "posted").
		Scan(&totalRefunded).Error; err != nil {
		return err
	}
	var saleTotal float64
	if err := tx.Table("sales").Select("total_amount").Where("business_id = ? AND id = ?", businessID, saleID).Scan(&saleTotal).Error; err != nil {
		return err
	}
	status := "none"
	if totalReturned > 0 {
		status = "partially_returned"
	}
	if saleTotal > 0 && totalReturned >= saleTotal-0.0001 {
		status = "returned"
	}
	return tx.Table("sales").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, saleID).
		Updates(map[string]interface{}{
			"return_status":          status,
			"returned_amount":        roundMoney(totalReturned),
			"return_refunded_amount": roundMoney(totalRefunded),
			"updated_at":             time.Now().UTC(),
		}).Error
}

func (r *Repository) GenerateReturnNumber(tx *gorm.DB, businessID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":sales_returns").Error; err != nil {
		return "", err
	}
	return utils.NextSequentialNumber(tx.Table("sales_returns").Where("business_id = ?", businessID), "return_number", "CN-", 6)
}

func (r *Repository) GeneratePaymentRefundNumber(tx *gorm.DB, businessID string, now time.Time) (string, error) {
	datePart := now.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":payment_refunds").Error; err != nil {
		return "", err
	}
	prefix := "PAY-RFND-" + datePart + "-"
	return utils.NextSequentialNumber(tx.Table("payment_refunds").Where("business_id = ?", businessID), "refund_number", prefix, 6)
}

func (r *Repository) LoadResponse(businessID string, salesReturn SalesReturn) (SalesReturnResponse, error) {
	responses, err := r.LoadResponses(businessID, []SalesReturn{salesReturn}, true)
	if err != nil {
		return SalesReturnResponse{}, err
	}
	if len(responses) == 0 {
		return SalesReturnResponse{}, gorm.ErrRecordNotFound
	}
	return responses[0], nil
}

func (r *Repository) LoadResponses(businessID string, returns []SalesReturn, includeItems bool) ([]SalesReturnResponse, error) {
	if len(returns) == 0 {
		return []SalesReturnResponse{}, nil
	}
	ids := make([]string, 0, len(returns))
	byID := make(map[string]SalesReturn, len(returns))
	for _, row := range returns {
		ids = append(ids, row.ID)
		byID[row.ID] = row
	}

	type detailRow struct {
		ID                      string
		BranchName              string
		SaleNumber              string
		CustomerName            string
		RefundPaymentMethodName string
		PaymentRefundNumber     string
		JournalEntryNumber      string
		CreatedByUserName       string
	}
	var details []detailRow
	if err := r.db.Table("sales_returns sr").
		Select(`
			sr.id,
			COALESCE(b.branch_name, '') AS branch_name,
			COALESCE(s.sale_number, '') AS sale_number,
			COALESCE(c.full_name, '') AS customer_name,
			COALESCE(pm.method_name, '') AS refund_payment_method_name,
			COALESCE(pr.refund_number, '') AS payment_refund_number,
			COALESCE(je.entry_number, '') AS journal_entry_number,
			COALESCE(u.full_name, '') AS created_by_user_name
		`).
		Joins("LEFT JOIN branches b ON b.id = sr.branch_id AND b.business_id = sr.business_id").
		Joins("LEFT JOIN sales s ON s.id = sr.sale_id AND s.business_id = sr.business_id").
		Joins("LEFT JOIN customers c ON c.id = sr.customer_id AND c.business_id = sr.business_id").
		Joins("LEFT JOIN payment_methods pm ON pm.id = sr.refund_payment_method_id AND pm.business_id = sr.business_id").
		Joins("LEFT JOIN payment_refunds pr ON pr.id = sr.payment_refund_id AND pr.business_id = sr.business_id").
		Joins("LEFT JOIN journal_entries je ON je.id = sr.journal_entry_id AND je.business_id = sr.business_id").
		Joins("LEFT JOIN users u ON u.id = sr.created_by_user_id AND u.business_id = sr.business_id").
		Where("sr.business_id = ? AND sr.id IN ?", businessID, ids).
		Scan(&details).Error; err != nil {
		return nil, err
	}
	detailByID := make(map[string]detailRow, len(details))
	for _, row := range details {
		detailByID[row.ID] = row
	}

	itemsByReturn := map[string][]SalesReturnItemResponse{}
	chargesByReturn := map[string][]charges.ChargeResponse{}
	if includeItems {
		var itemRows []SalesReturnItemResponse
		if err := r.db.Table("sales_return_items sri").
			Select(`
				sri.id,
				sri.sales_return_id,
				sri.sale_item_id,
				sri.product_id,
				sri.product_variant_id,
				sri.product_name_snapshot,
				COALESCE(sri.variant_name_snapshot, '') AS variant_name_snapshot,
				COALESCE(sri.sku_snapshot, '') AS sku_snapshot,
				CASE WHEN COALESCE(sri.variant_name_snapshot, '') <> '' THEN sri.product_name_snapshot || ' - ' || sri.variant_name_snapshot ELSE sri.product_name_snapshot END AS item_name_snapshot,
				sri.quantity,
				sri.unit_price,
				sri.discount_amount,
				sri.tax_rate_id,
				COALESCE(sri.tax_rate_name_snapshot, '') AS tax_rate_name_snapshot,
				sri.tax_rate_percentage_snapshot,
				sri.tax_amount,
				sri.line_subtotal,
				sri.line_total,
				sri.restock_action,
				sri.stock_location_id,
				COALESCE(sl.location_name, '') AS stock_location_name,
				sri.stock_movement_id,
				COALESCE(sri.reason, '') AS reason
			`).
			Joins("LEFT JOIN stock_locations sl ON sl.id = sri.stock_location_id AND sl.business_id = sri.business_id").
			Where("sri.business_id = ? AND sri.sales_return_id IN ? AND sri.deleted_at IS NULL", businessID, ids).
			Order("sri.created_at ASC, sri.id ASC").
			Scan(&itemRows).Error; err != nil {
			return nil, err
		}
		for _, row := range itemRows {
			itemsByReturn[row.SalesReturnID] = append(itemsByReturn[row.SalesReturnID], row)
		}
		for _, returnID := range ids {
			chargeRows, err := charges.ListChargeResponses(r.db, businessID, "sales_return", returnID)
			if err != nil {
				return nil, err
			}
			chargesByReturn[returnID] = chargeRows
		}
	}

	result := make([]SalesReturnResponse, 0, len(returns))
	for _, row := range returns {
		detail := detailByID[row.ID]
		result = append(result, SalesReturnResponse{
			ID:                      row.ID,
			BusinessID:              row.BusinessID,
			BranchID:                row.BranchID,
			BranchName:              detail.BranchName,
			SaleID:                  row.SaleID,
			SaleNumber:              detail.SaleNumber,
			CustomerID:              row.CustomerID,
			CustomerName:            detail.CustomerName,
			ReturnNumber:            row.ReturnNumber,
			ReturnDate:              row.ReturnDate.Format("2006-01-02"),
			Reason:                  row.Reason,
			Status:                  row.Status,
			SubtotalAmount:          row.SubtotalAmount,
			TaxAmount:               row.TaxAmount,
			ChargeAmount:            row.ChargeAmount,
			ChargeTaxAmount:         row.ChargeTaxAmount,
			ReturnTotal:             row.ReturnTotal,
			RefundMode:              row.RefundMode,
			RefundPaymentMethodID:   row.RefundPaymentMethodID,
			RefundPaymentMethodName: detail.RefundPaymentMethodName,
			RefundAmount:            row.RefundAmount,
			RefundReferenceNumber:   row.RefundReferenceNumber,
			PaymentRefundID:         row.PaymentRefundID,
			PaymentRefundNumber:     detail.PaymentRefundNumber,
			JournalEntryID:          row.JournalEntryID,
			JournalEntryNumber:      detail.JournalEntryNumber,
			ApprovedByUserID:        row.ApprovedByUserID,
			CreatedByUserID:         row.CreatedByUserID,
			CreatedByUserName:       detail.CreatedByUserName,
			PostedByUserID:          row.PostedByUserID,
			PostedAt:                row.PostedAt,
			CancelledByUserID:       row.CancelledByUserID,
			CancelledAt:             row.CancelledAt,
			Items:                   itemsByReturn[row.ID],
			Charges:                 chargesByReturn[row.ID],
			CreatedAt:               row.CreatedAt,
			UpdatedAt:               row.UpdatedAt,
		})
	}
	return result, nil
}

func applyListFilters(db *gorm.DB, query SalesReturnListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		db = db.Joins("LEFT JOIN sales s_filter ON s_filter.id = sales_returns.sale_id AND s_filter.business_id = sales_returns.business_id").
			Where("LOWER(sales_returns.return_number) LIKE ? OR LOWER(COALESCE(s_filter.sale_number, '')) LIKE ? OR LOWER(COALESCE(sales_returns.reason, '')) LIKE ?", like, like, like)
	}
	if query.SaleID != "" {
		db = db.Where("sale_id = ?", query.SaleID)
	}
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.CustomerID != "" {
		db = db.Where("customer_id = ?", query.CustomerID)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.DateFrom != "" {
		db = db.Where("return_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("return_date <= ?", query.DateTo)
	}
	return db
}
