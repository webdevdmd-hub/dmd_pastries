package accounting

import (
	"os"
	"strings"
	"testing"
)

// A supplier bill is created against the purchase order, and nothing ever
// writes purchase_receipts.purchase_invoice_id. Matching a receipt to its bill
// on that column alone therefore matched nothing, so posting a bill left its
// Inventory / Stock lines "unassigned" and left every received item reading
// "Pending bill posting" in the reconciliation report for good.
//
// These assertions are structural rather than behavioural: they cannot prove
// the SQL reconciles, only that the fallback has not been dropped from the
// predicate or from the query that consumes it. The behaviour itself is
// checked against a live report.
func TestReceiptBilledLinkKeepsPurchaseOrderFallback(t *testing.T) {
	if !strings.Contains(receiptBilledLinkSQL, "pi.id = pr.purchase_invoice_id") {
		t.Error("receiptBilledLinkSQL lost the direct receipt-to-bill link")
	}
	if !strings.Contains(receiptBilledLinkSQL, "pi.purchase_order_id = pr.purchase_order_id") {
		t.Error("receiptBilledLinkSQL lost the purchase-order fallback; " +
			"bills created from a PO would stop counting as billed")
	}
	if !strings.Contains(receiptBilledLinkSQL, "pr.purchase_invoice_id IS NULL") {
		t.Error("the purchase-order fallback must only apply when there is no direct link, " +
			"or a receipt could match a second bill on the same order")
	}
}

func TestUnassignedInventoryJournalQueryUsesSharedBilledLink(t *testing.T) {
	if !strings.Contains(unassignedInventoryJournalLinesSQL, receiptBilledLinkSQL) {
		t.Fatal("unassignedInventoryJournalLinesSQL no longer embeds receiptBilledLinkSQL; " +
			"posted bill journals would show as unassigned Inventory / Stock lines")
	}
}

// The inventory module answers the same question for the Inventory screen's
// "Pending Bill Posting" flag. The two drifted once already -- accounting kept
// only the direct link, so the two screens disagreed about the same receipt --
// and nothing but this test connects them.
func TestInventoryModuleUsesTheSameBilledRule(t *testing.T) {
	source, err := os.ReadFile("../inventory/repository.go")
	if err != nil {
		t.Skipf("cannot read the inventory repository to compare rules: %v", err)
	}

	text := string(source)
	for _, clause := range []string{
		"pi.id = pr.purchase_invoice_id",
		"pi.purchase_order_id = pr.purchase_order_id",
	} {
		if !strings.Contains(text, clause) {
			t.Errorf("the inventory module no longer matches receipts to bills with %q; "+
				"it and accounting must agree, or the Inventory screen and the "+
				"reconciliation report will disagree about the same receipt", clause)
		}
	}
}
