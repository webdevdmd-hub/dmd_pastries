package reports

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-012 — the accounting consistency panel warned permanently on normal open orders.
//
// Financial reports display ledger figures and keep an operational sum as a
// cross-check, reporting any difference as drift. That only works if both sides
// recognise revenue at the same moment. They did not.
//
// A bakery order recognises revenue at COMPLETION, the same event that moves
// stock and posts COGS (Phase 4 / W1). The operational cross-checks counted
// every order that was merely "not cancelled", so the entire booked-but-not-
// shipped backlog was reported as ledger drift. A bakery that takes orders in
// advance always has such a backlog, so the warning was permanent, and its
// advice -- "Run the accounting backfill or check for missing journals" --
// could never resolve it, because nothing was missing.
//
// Measured on production on 2026-09-14 with five live orders, one of them
// booked and not yet completed:
//
//	gross_sales                   ledger 1767.00  operational 2118.00  (-351.00)
//	outstanding_customer_balance  ledger 1316.00  operational 1617.00  (-301.00)
//
// Both differences were exactly that one open order: its 351.00 of unrecognised
// revenue, and its 301.00 balance, which is not a receivable because no revenue
// has posted against it. Its 50.00 deposit was correctly sitting in Customer
// Advance, a liability.
//
// The cost is not a wrong number on screen -- the displayed figures come from
// the ledger and were right. The cost is that an accounting integrity control
// was permanently red, which teaches an operator to ignore it, including on the
// day it reports something real.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestLedgerCrossChecksUseTheRevenueRecognitionPoint(t *testing.T) {
	filter := testBakeryOrdersReportFilter()

	grossSales, _ := financialGrossSalesSummarySQL(filter)
	if !strings.Contains(grossSales, "order_status = 'completed'") {
		t.Error("the gross sales cross-check must count only completed bakery orders: it is compared " +
			"against the ledger, which recognises bakery revenue at completion. Counting every " +
			"non-cancelled order reports the un-shipped backlog as drift")
	}
	if strings.Contains(grossSales, "bo.order_status <> 'cancelled'") {
		t.Error("the gross sales cross-check still admits non-cancelled orders, which is an " +
			"operational predicate and never a revenue figure")
	}

	outstanding, _ := financialOutstandingSummarySQL(filter)
	if !strings.Contains(outstanding, "order_status = 'completed'") {
		t.Error("the outstanding cross-check must count only completed bakery orders: an order that " +
			"has not completed has no receivable, and any deposit against it sits in Customer " +
			"Advance, a liability")
	}

	// The collections LIST is deliberately wider and must stay that way. "Who
	// owes us money" rightly includes an order that has not shipped yet. The
	// two answer different questions; narrowing the list would hide real debt.
	rows, _ := financialOutstandingRowsSQL(filter)
	if strings.Contains(rows, "order_status = 'completed'") {
		t.Error("the outstanding ROW list must keep the wider predicate: it is a collections list, " +
			"not a ledger comparison, and an unshipped order with a balance is still owed")
	}
	if !strings.Contains(rows, "bo.order_status <> 'cancelled'") {
		t.Error("the outstanding row list lost its operational predicate, so open orders that are " +
			"genuinely owed would vanish from collections")
	}
}

// A sale that came to nothing has no revenue to recognise, so having no revenue
// journal is correct, not a fault. Flagging it sent the operator hunting for a
// backfill to fix a sale that was never going to have one.
//
// This became reachable when ISSUE-001 made zero-total sales possible: a comp,
// a staff meal or a 100%-off promotion now rings through and lands here.
func TestZeroTotalSalesAreNotMissingRevenueJournals(t *testing.T) {
	raw, err := os.ReadFile("shared/metrics.go")
	if err != nil {
		t.Fatalf("read shared/metrics.go: %v", err)
	}
	source := string(raw)
	start := strings.Index(source, `code:       "pos_sales_missing_journals"`)
	if start == -1 {
		t.Fatal("pos_sales_missing_journals check not found")
	}
	end := strings.Index(source[start:], "code:       \"bakery_order_revenue_missing_journals\"")
	if end == -1 {
		end = len(source) - start
	}
	check := source[start : start+end]

	if !strings.Contains(check, "s.total_amount > 0") {
		t.Error("the missing-revenue-journal check must skip zero-total sales: a comped sale posts " +
			"no revenue journal because it has no revenue, and reporting that as a missing journal " +
			"is a fault that does not exist")
	}
}
