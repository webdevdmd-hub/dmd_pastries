package shared

import "strings"

// Canonical status predicates.
//
// The same entity was being filtered with incompatible status sets across
// modules — sales as IN('completed','partially_refunded','refunded') in one
// query and <> 'voided' in another, purchase invoices as = 'posted' in the
// ledger views and <> 'cancelled' in the operational ones. That mismatch is
// what produces a permanent, unexplainable variance between the reports, the
// dashboard, and the reconciliation screens.
//
// Every status filter on these entities must come from this file. There is a
// guard test asserting no raw status literals survive elsewhere.

func qualify(alias, column string) string {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return column
	}
	return alias + "." + column
}

// --- Sales -----------------------------------------------------------------

// SaleRevenueStatuses are the statuses that contribute to revenue. Refunded and
// partially-refunded sales are included at gross; the refund is subtracted
// separately, so excluding them here would double-count the reduction.
func SaleRevenueStatuses() []string {
	return []string{"completed", "partially_refunded", "refunded"}
}

// SaleActiveStatuses are the statuses counted as live transactions, used for
// sale counts and average-order-value denominators.
func SaleActiveStatuses() []string {
	return []string{"completed", "partially_refunded"}
}

func SaleRevenueCondition(alias string) string {
	return qualify(alias, "sale_status") + " IN ('completed','partially_refunded','refunded')"
}

func SaleActiveCondition(alias string) string {
	return qualify(alias, "sale_status") + " IN ('completed','partially_refunded')"
}

// SaleNotVoidedCondition is deliberately broader than SaleRevenueCondition: it
// admits in-flight statuses such as draft and held. Use it only for operational
// listings, never for a revenue figure.
func SaleNotVoidedCondition(alias string) string {
	return qualify(alias, "sale_status") + " <> 'voided'"
}

// --- Purchase invoices -----------------------------------------------------

// PurchaseInvoiceLedgerCondition scopes anything that feeds accounts payable or
// the ledger. Only posted bills are liabilities; a draft is not owed to anyone.
func PurchaseInvoiceLedgerCondition(alias string) string {
	return qualify(alias, "status") + " = 'posted'"
}

// PurchaseInvoiceOperationalCondition scopes operational listings, which may
// legitimately show drafts. It must never feed an AP figure.
func PurchaseInvoiceOperationalCondition(alias string) string {
	return qualify(alias, "status") + " <> 'cancelled'"
}

func PurchaseInvoiceOutstandingCondition(alias string) string {
	return qualify(alias, "payment_status") + " IN ('unpaid','partial','overdue')"
}

// --- Bakery orders ---------------------------------------------------------

func BakeryOrderRevenueCondition(alias string) string {
	return qualify(alias, "order_status") + " <> 'cancelled'"
}

func BakeryOrderCompletedCondition(alias string) string {
	return qualify(alias, "order_status") + " = 'completed'"
}

// BakeryOrderPaymentCondition guards bakery payments through their parent order
// and therefore takes the ORDER alias, not the payment alias.
//
// bakery_order_payments has neither a status nor a deleted_at column (see
// migration 000025), so a payment can only be invalidated by its order. Queries
// were applying the parent's deleted_at but not its status, which let payments
// against a later-cancelled order keep counting as collected revenue.
func BakeryOrderPaymentCondition(orderAlias string) string {
	return qualify(orderAlias, "deleted_at") + " IS NULL AND " +
		qualify(orderAlias, "order_status") + " <> 'cancelled'"
}

// --- Payments & refunds ----------------------------------------------------

// PaymentFinancialImpactStatuses are the sale_payments statuses that moved money.
func PaymentFinancialImpactStatuses() []string {
	return []string{"completed", "partially_refunded", "refunded"}
}

func PaymentFinancialImpactCondition(alias string) string {
	return qualify(alias, "payment_status") + " IN ('completed','partially_refunded','refunded')"
}

func RefundCompletedCondition(alias string) string {
	return qualify(alias, "refund_status") + " = 'completed'"
}

// --- Journals --------------------------------------------------------------

// JournalPostedCondition includes reversed entries on purpose: a reversed entry
// and its mirror both remain in the ledger and net to zero. Excluding them would
// leave the mirror unbalanced.
func JournalPostedCondition(alias string) string {
	return qualify(alias, "status") + " IN ('posted','reversed')"
}
