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
	CreatedAt       time.Time              `json:"created_at"`
}

type ActivityLogListResponse struct {
	Items      []ActivityLogResponse `json:"items"`
	NextCursor *string               `json:"next_cursor"`
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
	case "stock_movement", "stock_movements", "stock_transfer", "stock_transfers":
		return "Inventory -> Stock Movements"
	case "pos", "sale", "sales", "sale_refund", "sale_refunds":
		return "POS"
	case "bakery_order", "bakery_orders":
		return "Bakery Orders"
	case "expense", "expenses":
		return "Expenses"
	case "purchase_order", "purchase_orders", "purchase_invoice", "purchase_invoices", "purchase_receipt", "purchase_receipts", "purchase_return", "purchase_returns", "purchasing":
		return "Purchasing"
	case "supplier", "suppliers":
		return "Suppliers"
	case "customer", "customers":
		return "Customers"
	case "recipe", "recipes":
		return "Recipes"
	case "manufacturing", "production_batch", "production_batches":
		return "Manufacturing"
	case "chart_account", "chart_accounts", "payment_account", "payment_accounts", "journal_entry", "journal_entries", "accounting":
		return "Accounting"
	case "reports", "report":
		return "Reports"
	default:
		return humanizeAuditWords(entityType)
	}
}

func humanizeEventType(eventType, entityType string) string {
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
		"batch_number", "production_batch_number", "invoice_number", "receipt_number",
		"return_number", "product_code", "sku",
	}
	for _, key := range keys {
		if value, ok := metadata[key]; ok {
			if label := metadataString(value); label != "" {
				return label
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
