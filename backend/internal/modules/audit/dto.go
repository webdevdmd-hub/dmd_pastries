package audit

import (
	"encoding/json"
	"strings"
	"time"
	"unicode"
)

type ActivityLogResponse struct {
	ID              string                 `json:"id"`
	BusinessID      string                 `json:"business_id"`
	ActorUserID     string                 `json:"actor_user_id"`
	ActorUserName   string                 `json:"actor_user_name"`
	ActorUserEmail  string                 `json:"actor_user_email"`
	TargetUserID    *string                `json:"target_user_id"`
	TargetUserName  string                 `json:"target_user_name"`
	TargetUserEmail string                 `json:"target_user_email"`
	EventType       string                 `json:"event_type"`
	EntityType      string                 `json:"entity_type"`
	EntityID        string                 `json:"entity_id"`
	ModuleLabel     string                 `json:"module_label"`
	ActionLabel     string                 `json:"action_label"`
	RecordLabel     string                 `json:"record_label"`
	Summary         string                 `json:"summary"`
	Metadata        map[string]interface{} `json:"metadata"`
	Changes         []AuditChange          `json:"changes"`
	IPAddress       string                 `json:"ip_address"`
	UserAgent       string                 `json:"user_agent"`
	CreatedAt       time.Time              `json:"created_at"`
}

type ActivityLogListResponse struct {
	Items      []ActivityLogResponse `json:"items"`
	NextCursor *string               `json:"next_cursor"`
}

type ActivityLogQuery struct {
	EntityType   string
	TargetUserID string
	Cursor       string
	LimitValue   string
	DateFrom     string
	DateTo       string
	Timezone     string
}

type ActivityUserDisplay struct {
	ID       string
	FullName string
	Email    string
}

func ToActivityLogResponse(log AuditLog) ActivityLogResponse {
	return ToActivityLogResponseWithDisplay(log, nil, nil, "")
}

func ToActivityLogResponseWithDisplay(log AuditLog, actor *ActivityUserDisplay, target *ActivityUserDisplay, recordLabel string) ActivityLogResponse {
	metadata := map[string]interface{}{}
	if log.Metadata != "" {
		_ = json.Unmarshal([]byte(log.Metadata), &metadata)
	}

	eventType := firstNonEmpty(log.EventType, log.ActionType, "unknown.event")
	entityType := firstNonEmpty(log.EntityType, log.ModuleName, "unknown")
	entityID := firstNonEmpty(log.EntityID, log.ReferenceID)
	summary := firstNonEmpty(log.Summary, humanizeEventType(eventType, entityType))
	actorUserID := firstNonEmpty(log.ActorUserID, log.UserID)
	actorUserName, actorUserEmail := activityUserDisplay(actorUserID, actor)
	targetUserName := ""
	targetUserEmail := ""
	if target != nil {
		targetUserName, targetUserEmail = activityUserDisplay("", target)
	} else if log.TargetUserID != nil && *log.TargetUserID != "" {
		targetUserName = "Unknown user"
	}

	if recordLabel == "" {
		recordLabel = fallbackRecordLabel(entityID, summary, metadata)
	}

	return ActivityLogResponse{
		ID:              log.ID,
		BusinessID:      log.BusinessID,
		ActorUserID:     actorUserID,
		ActorUserName:   actorUserName,
		ActorUserEmail:  actorUserEmail,
		TargetUserID:    log.TargetUserID,
		TargetUserName:  targetUserName,
		TargetUserEmail: targetUserEmail,
		EventType:       eventType,
		EntityType:      entityType,
		EntityID:        entityID,
		ModuleLabel:     moduleLabel(entityType),
		ActionLabel:     humanizeEventType(eventType, entityType),
		RecordLabel:     recordLabel,
		Summary:         summary,
		Metadata:        metadata,
		Changes:         ParseChanges(metadata),
		IPAddress:       log.IPAddress,
		UserAgent:       log.UserAgent,
		CreatedAt:       log.CreatedAt,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func activityUserDisplay(userID string, user *ActivityUserDisplay) (string, string) {
	if user != nil {
		return firstNonEmpty(user.FullName, user.Email, "Unknown user"), user.Email
	}
	if userID == "" {
		return "System", ""
	}
	return "Unknown user", ""
}

func moduleLabel(entityType string) string {
	switch normalizeAuditKey(entityType) {
	case "auth":
		return "Authentication"
	case "business":
		return "Business Settings"
	case "user", "users", "user_invitation", "user_invitations":
		return "Administration -> Users"
	case "role", "roles", "role_permission", "role_permissions":
		return "Administration -> Roles"
	case "settings", "company_settings":
		return "Settings"
	case "tax_rate", "tax_rates", "product_tax", "product_taxes":
		return "Settings -> Tax Rates"
	case "payment_method", "payment_methods":
		return "Settings -> Payment Methods"
	case "branch", "branches":
		return "Branches"
	case "product", "products", "product_variant", "product_variants", "product_category", "product_categories":
		return "Products"
	case "ingredient", "ingredients":
		return "Ingredients"
	case "packaging", "packaging_item", "packaging_items":
		return "Packaging"
	case "inventory", "inventory_item", "inventory_items":
		return "Inventory"
	case "stock_location", "stock_locations", "stock_movement", "stock_movements", "stock_transfer", "stock_transfers":
		return "Inventory -> Stock Movements"
	case "pos", "sale", "sales", "sale_refund", "sale_refunds", "payment", "payments", "sale_payment", "sale_payments", "payment_refund", "payment_refunds", "sales_return", "sales_returns":
		return "POS"
	case "bakery_order", "bakery_orders", "bakery_order_payment", "bakery_order_payments":
		return "Bakery Orders"
	case "expense", "expenses":
		return "Expenses"
	case "purchase_order", "purchase_orders", "purchase_invoice", "purchase_invoices", "supplier_bill", "supplier_bills", "purchase_bill", "purchase_bills", "bill", "bills", "purchase_receipt", "purchase_receipts", "goods_receipt", "goods_receipts", "grn", "grns", "purchase_return", "purchase_returns", "vendor_credit", "vendor_credits", "supplier_payment", "supplier_payments", "purchasing":
		return "Purchasing"
	case "supplier", "suppliers":
		return "Suppliers"
	case "customer", "customers":
		return "Customers"
	case "recipe", "recipes":
		return "Recipes"
	case "manufacturing", "manufacturing_batch", "manufacturing_batches", "production", "productions", "production_batch", "production_batches":
		return "Manufacturing"
	case "chart_account", "chart_accounts", "payment_account", "payment_accounts", "journal_entry", "journal_entries", "account_transfer", "account_transfers", "platform_settlement", "platform_settlements", "accounting":
		return "Accounting"
	case "reports", "report":
		return "Reports"
	default:
		return humanizeAuditWords(entityType)
	}
}

func humanizeEventType(eventType, entityType string) string {
	if label := businessEventLabel(eventType, entityType); label != "" {
		return label
	}

	eventParts := strings.FieldsFunc(eventType, func(r rune) bool {
		return r == '.' || r == '_' || r == '-'
	})
	if len(eventParts) == 0 {
		return humanizeAuditWords(entityType)
	}

	action := eventParts[len(eventParts)-1]
	nounParts := eventParts[:len(eventParts)-1]
	if len(nounParts) == 0 && entityType != "" {
		nounParts = strings.FieldsFunc(entityType, func(r rune) bool {
			return r == '.' || r == '_' || r == '-'
		})
	}
	if len(nounParts) == 0 {
		return humanizeAuditWords(eventType)
	}

	return strings.TrimSpace(humanizeAction(action) + " " + humanizeAuditWords(strings.Join(nounParts, " ")))
}

func businessEventLabel(eventType, entityType string) string {
	normalizedEvent := normalizeAuditEventKey(eventType)
	normalizedEntity := normalizeAuditKey(entityType)

	switch normalizedEvent {
	case "purchase_return_created":
		return "Created Vendor Credit"
	case "purchase_return_updated":
		return "Updated Vendor Credit"
	case "purchase_return_posted":
		return "Posted Vendor Credit"
	case "purchase_return_stock_returned":
		return "Returned Vendor Credit Stock"
	case "purchase_return_cancelled":
		return "Cancelled Vendor Credit"
	case "purchase_return_reversed":
		return "Reversed Vendor Credit"
	case "purchase_return_stock_reversal":
		return "Reversed Vendor Credit Stock"
	case "inventory_opening_stock_created":
		return "Created Opening Stock"
	case "inventory_adjusted":
		return "Adjusted Inventory"
	case "stock_movement_manual_created":
		return "Created Manual Stock Movement"
	case "stock_movement_reversed":
		return "Reversed Stock Movement"
	case "stock_transfer_created":
		return "Created Stock Transfer"
	case "stock_transfer_completed":
		return "Completed Stock Transfer"
	case "stock_transfer_cancelled":
		return "Cancelled Stock Transfer"
	case "accounting_journal_entry_created":
		return "Created Journal Entry"
	case "accounting_journal_entry_updated":
		return "Updated Journal Entry"
	case "accounting_journal_entry_posted":
		return "Posted Journal Entry"
	case "accounting_journal_entry_reversed":
		return "Reversed Journal Entry"
	case "accounting_journal_entry_hard_deleted":
		return "Deleted Journal Entry"
	case "sale_created":
		return "Created POS Sale"
	case "sale_refunded":
		return "Created POS Refund"
	case "sale_voided":
		return "Voided POS Sale"
	case "bakery_order_payment_added":
		return "Added Bakery Order Payment"
	}

	if normalizedEntity == "purchase_return" {
		return strings.TrimSpace(humanizeAction(lastAuditEventPart(eventType)) + " Vendor Credit")
	}
	return ""
}

func normalizeAuditEventKey(value string) string {
	value = strings.ReplaceAll(value, ".", "_")
	return normalizeAuditKey(value)
}

func lastAuditEventPart(eventType string) string {
	parts := strings.FieldsFunc(eventType, func(r rune) bool {
		return r == '.' || r == '_' || r == '-' || unicode.IsSpace(r)
	})
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

func humanizeAction(action string) string {
	switch normalizeAuditKey(action) {
	case "create", "created":
		return "Created"
	case "update", "updated":
		return "Updated"
	case "delete", "deleted", "soft_deleted":
		return "Deleted"
	case "restore", "restored":
		return "Restored"
	case "login", "logged_in":
		return "Logged In"
	case "logout", "logged_out":
		return "Logged Out"
	case "cancel", "cancelled", "canceled":
		return "Cancelled"
	case "post", "posted":
		return "Posted"
	case "complete", "completed":
		return "Completed"
	case "approve", "approved":
		return "Approved"
	case "assign", "assigned":
		return "Assigned"
	case "switch", "switched":
		return "Switched"
	case "invite", "invited":
		return "Invited"
	case "resent":
		return "Resent"
	case "accepted":
		return "Accepted"
	case "void", "voided":
		return "Voided"
	case "reverse", "reversed":
		return "Reversed"
	default:
		return humanizeAuditWords(action)
	}
}

func fallbackRecordLabel(entityID, summary string, metadata map[string]interface{}) string {
	if label := metadataRecordLabel(metadata); label != "" {
		return label
	}
	if summary != "" {
		return summary
	}
	if entityID != "" {
		return shortAuditID(entityID)
	}
	return "Unknown record"
}

func metadataRecordLabel(metadata map[string]interface{}) string {
	keys := []string{
		"record_label", "record_name", "name", "full_name", "email",
		"branch_name", "role_name", "product_name", "variant_name",
		"tax_rate_name", "tax_name", "payment_method_name", "method_name",
		"sale_number", "order_number", "expense_number", "transfer_number",
		"reference_number", "supplier_name", "customer_name", "recipe_name",
		"document_number", "batch_number", "production_batch_number", "manufacturing_batch_number",
		"invoice_number", "purchase_invoice_number", "supplier_bill_number", "bill_number",
		"receipt_number", "purchase_receipt_number", "goods_receipt_number",
		"return_number", "purchase_order_number", "sales_return_number", "refund_number",
		"entry_number", "journal_entry_number", "settlement_number",
		"product_code", "sku",
	}
	for _, key := range keys {
		if value, ok := metadata[key]; ok {
			if label := metadataString(value); label != "" {
				if isAuditUUIDLike(label) {
					continue
				}
				return label
			}
		}
	}
	return ""
}

func metadataBusinessReference(metadata map[string]interface{}) string {
	keys := []string{
		"record_number", "document_number", "reference_number",
		"sale_number", "refund_number", "payment_refund_number",
		"order_number", "expense_number", "transfer_number", "settlement_number",
		"entry_number", "journal_entry_number", "invoice_number", "purchase_invoice_number",
		"supplier_bill_number", "bill_number", "receipt_number", "purchase_receipt_number",
		"goods_receipt_number", "return_number", "sales_return_number", "purchase_order_number",
		"batch_number", "production_batch_number", "manufacturing_batch_number", "source_number",
	}
	for _, key := range keys {
		if value, ok := metadata[key]; ok {
			if reference := metadataString(value); reference != "" {
				if !isAuditUUIDLike(reference) {
					return reference
				}
			}
		}
	}
	return ""
}

func metadataString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return ""
	}
}

func shortAuditID(value string) string {
	if len(value) <= 8 {
		return value
	}
	return value[:8]
}

func isAuditUUIDLike(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) == 36 {
		for index, char := range value {
			switch index {
			case 8, 13, 18, 23:
				if char != '-' {
					return false
				}
			default:
				if !isHexRune(char) {
					return false
				}
			}
		}
		return true
	}
	if len(value) == 32 {
		for _, char := range value {
			if !isHexRune(char) {
				return false
			}
		}
		return true
	}
	return false
}

func isHexRune(char rune) bool {
	return (char >= '0' && char <= '9') ||
		(char >= 'a' && char <= 'f') ||
		(char >= 'A' && char <= 'F')
}

func normalizeAuditKey(value string) string {
	return strings.ToLower(strings.TrimSpace(strings.ReplaceAll(value, "-", "_")))
}

func humanizeAuditWords(value string) string {
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == '.' || r == '_' || r == '-' || unicode.IsSpace(r)
	})
	if len(parts) == 0 {
		return "Unknown"
	}
	for index, part := range parts {
		if part == "" {
			continue
		}
		runes := []rune(strings.ToLower(part))
		runes[0] = unicode.ToUpper(runes[0])
		parts[index] = string(runes)
	}
	return strings.Join(parts, " ")
}
