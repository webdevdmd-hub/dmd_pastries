package purchasing

import (
	"strings"
	"testing"
)

// Regression: ISSUE-033 — a billed and paid purchase order said "Ready to bill".
//
// The purchase order list carried no items and no document chain, so its Next
// Step cell could not tell a billable order from one already billed. On
// production on 2026-09-16 PO-000001 -- received, billed as QAF-INV-1001, paid
// in full -- read "Ready to bill", an instruction to raise a second bill for
// goods already billed and paid. The same gap made a PO with 1 of 500 received
// read exactly like one with 499 of 500. Filed as TODOS T-R; now fixed.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestOrderReceivingSummaryCountsLinesNotQuantities(t *testing.T) {
	account := "acct"
	summary := orderReceivingSummary([]PurchaseOrderItem{
		{LineType: "product", ItemType: "product", QuantityOrdered: 2, QuantityReceived: 2, UnitCost: 270},
		{LineType: "product", ItemType: "ingredient", QuantityOrdered: 10, QuantityReceived: 4, UnitCost: 3},
		{LineType: "product", ItemType: "packaging", QuantityOrdered: 5, QuantityReceived: 7, UnitCost: 1},
		{LineType: "account", ItemType: "account", AccountID: &account, QuantityOrdered: 1, QuantityReceived: 0, UnitCost: 900},
	})

	if summary.StockLines != 3 {
		t.Errorf("stock lines = %d, want 3: an account row buys an expense and has no received half", summary.StockLines)
	}
	if summary.ReceivedLines != 2 {
		t.Errorf("received lines = %d, want 2: the fully received line and the over-received one", summary.ReceivedLines)
	}
	// Only the ingredient line is short: 6 x 3.00. Over-receipt never subtracts,
	// and the account row's 900.00 is not undelivered goods.
	if summary.UnreceivedValue != 18 {
		t.Errorf("unreceived value = %.2f, want 18.00", summary.UnreceivedValue)
	}
}

// The billing flag must reach the list, where the bug was.
func TestOrderResponseCarriesBillingStateOnTheListPath(t *testing.T) {
	body := functionBody(purchasingSource(t, "service.go"), "func (s *Service) orderResponse(")
	if body == "" {
		t.Fatal("orderResponse not found")
	}
	flag := strings.Index(body, "response.HasActiveBill")
	summary := strings.Index(body, "orderReceivingSummary(")
	itemsOnly := strings.Index(body, "if includeItems {")
	if flag == -1 || !strings.Contains(body, "ActiveInvoiceCountForOrder(") {
		t.Fatal("orderResponse must set HasActiveBill from ActiveInvoiceCountForOrder, or a billed order reads \"Ready to bill\"")
	}
	if summary == -1 {
		t.Fatal("orderResponse must summarise receiving with orderReceivingSummary")
	}
	if itemsOnly != -1 && (flag > itemsOnly || summary > itemsOnly) {
		t.Error("the billing flag and receiving summary are computed inside `if includeItems`, so the list " +
			"path -- which passes includeItems=false -- never gets them, which is the bug")
	}
}
