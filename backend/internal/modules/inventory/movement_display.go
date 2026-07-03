package inventory

import "strings"

type stockMovementDisplayFields struct {
	MovementLabel        string
	SourceModuleLabel    string
	SourceReferenceLabel string
	MovementDescription  string
}

func stockMovementDisplay(movement StockMovement, createdByName, fromLocationName, toLocationName string) stockMovementDisplayFields {
	movementLabel := movementTypeLabel(movement.MovementType)
	sourceModuleLabel := sourceModuleLabel(movement.ReferenceType, movement.MovementType)
	referenceLabel := sourceReferenceLabel(movement.ReferenceNumber, movement.ReferenceType)
	description := movementDescription(movement, movementLabel, referenceLabel, createdByName, fromLocationName, toLocationName)

	return stockMovementDisplayFields{
		MovementLabel:        movementLabel,
		SourceModuleLabel:    sourceModuleLabel,
		SourceReferenceLabel: referenceLabel,
		MovementDescription:  description,
	}
}

func movementDescription(movement StockMovement, movementLabel, referenceLabel, createdByName, fromLocationName, toLocationName string) string {
	reason := strings.TrimSpace(movement.Reason)
	actor := friendlyValue(createdByName, "System")

	switch movement.MovementType {
	case "opening_stock":
		return "Opening stock created by " + actor
	case "purchase_in":
		return "Purchased through GRN " + referenceLabel
	case "sale_out":
		return "Sold through POS Receipt " + referenceLabel
	case "return_in":
		if movement.ReferenceType == "sale_void" {
			return "Returned from voided POS Receipt " + referenceLabel
		}
		if movement.ReferenceType == "sales_return" {
			return "Returned from Sales Return " + referenceLabel
		}
		return withReference("Returned stock", referenceLabel)
	case "production_out":
		return "Used in Production Batch " + referenceLabel
	case "production_in":
		return "Produced from Manufacturing Batch " + referenceLabel
	case "wastage":
		if movement.ReferenceType == "production_batch" {
			return "Wastage from Production Batch " + referenceLabel
		}
		return withReason("Wastage recorded by "+actor, reason)
	case "transfer", "transfer_in", "transfer_out":
		return "Transferred from " + friendlyValue(fromLocationName, "Unknown location") + " to " + friendlyValue(toLocationName, "Unknown location")
	case "adjustment_in", "adjustment_out":
		if movement.ReferenceType == "purchase_receipt_cancelled" || movement.ReferenceType == "purchase_invoice_cancel" {
			return "Stock removed due to purchase cancellation " + referenceLabel
		}
		if movement.ReferenceType == "purchase_return_reversal" {
			return "Reversed Vendor Credit " + referenceLabel
		}
		return withReason("Manual stock adjustment by "+actor, reason)
	case "purchase_return_out":
		return "Returned to supplier through Vendor Credit " + referenceLabel
	case "purchase_bill_cancel_out":
		return "Stock removed due to purchase cancellation " + referenceLabel
	case "reversal":
		return "Reversal of stock movement " + referenceLabel
	default:
		if reason != "" {
			return movementLabel + " - " + reason
		}
		if referenceLabel != "Manual" {
			return movementLabel + " " + referenceLabel
		}
		return movementLabel
	}
}

func movementTypeLabel(value string) string {
	switch value {
	case "opening_stock":
		return "Opening Stock"
	case "purchase_in":
		return "Purchase / GRN"
	case "sale_out":
		return "POS Sale"
	case "adjustment_in":
		return "Stock Adjustment In"
	case "adjustment_out":
		return "Stock Adjustment Out"
	case "wastage":
		return "Wastage"
	case "return_in":
		return "Sales Return"
	case "transfer", "transfer_in", "transfer_out":
		return "Stock Transfer"
	case "production_in":
		return "Production Output"
	case "production_out":
		return "Production Consumption"
	case "purchase_return_out":
		return "Vendor Credit"
	case "purchase_bill_cancel_out":
		return "Purchase Cancellation"
	case "reversal":
		return "Reversal"
	default:
		return humanizeIdentifier(value)
	}
}

func sourceModuleLabel(referenceType, movementType string) string {
	switch referenceType {
	case "opening_stock":
		return "Inventory"
	case "purchase_receipt":
		return "Purchasing / GRN"
	case "purchase_return", "purchase_return_reversal":
		return "Purchasing / Vendor Credit"
	case "purchase_receipt_cancelled", "purchase_invoice_cancel":
		return "Purchasing"
	case "sale", "sale_void":
		return "POS"
	case "sales_return":
		return "Sales Return"
	case "production_batch":
		return "Manufacturing"
	case "stock_transfer":
		return "Stock Transfer"
	case "inventory_adjustment", "manual_adjustment", "movement_reversal":
		return "Inventory"
	default:
		if movementType == "transfer" {
			return "Stock Transfer"
		}
		return "Inventory"
	}
}

func sourceReferenceLabel(referenceNumber, referenceType string) string {
	reference := strings.TrimSpace(referenceNumber)
	if reference != "" {
		if strings.HasPrefix(reference, "#") {
			return reference
		}
		return "#" + reference
	}
	if strings.TrimSpace(referenceType) != "" {
		return strings.ReplaceAll(referenceType, "_", " ")
	}
	return "Manual"
}

func withReason(prefix, reason string) string {
	if strings.TrimSpace(reason) == "" {
		return prefix
	}
	return prefix + " - " + strings.TrimSpace(reason)
}

func withReference(prefix, reference string) string {
	if reference == "Manual" {
		return prefix
	}
	return prefix + " " + reference
}

func friendlyValue(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func humanizeIdentifier(value string) string {
	words := strings.Fields(strings.ReplaceAll(value, "_", " "))
	for index, word := range words {
		if word == "" {
			continue
		}
		words[index] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
	}
	if len(words) == 0 {
		return "Stock Movement"
	}
	return strings.Join(words, " ")
}
