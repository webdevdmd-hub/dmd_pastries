package accounting

import (
	"strings"
	"testing"

	reportshared "pastries-pos/internal/modules/reports/shared"
)

// The defect these guard: the reports flagged POS sales as missing journals
// with one status set while posting and backfill used another, so refunded
// sales were reported forever but never candidates — the warning could never
// clear. Posting, backfill, and reporting must share the revenue status set.

func TestSaleStatusPostsRevenueMatchesReportPredicate(t *testing.T) {
	for _, status := range reportshared.SaleRevenueStatuses() {
		if !saleStatusPostsRevenue(status) {
			t.Fatalf("saleStatusPostsRevenue(%q) = false, must accept every reports/shared revenue status", status)
		}
	}
	for _, status := range []string{"voided", "draft", "held", ""} {
		if saleStatusPostsRevenue(status) {
			t.Fatalf("saleStatusPostsRevenue(%q) = true, must reject non-revenue statuses", status)
		}
	}
}

func TestBackfillPOSSalesCandidateStatusParity(t *testing.T) {
	_, _, _, _, _, _, statusColumn, statusValue, missingCondition, extraCondition := backfillTargetQuery("pos_sales")
	if statusColumn != "" || statusValue != "" {
		t.Fatalf("pos_sales status filter must live in extraCondition (equality tuple cannot express the revenue set), got %q=%q", statusColumn, statusValue)
	}
	if !strings.Contains(extraCondition, reportshared.SaleRevenueCondition("")) {
		t.Fatalf("pos_sales extra condition %q must use the canonical revenue status predicate", extraCondition)
	}
	if !strings.Contains(missingCondition, "cogs_journal_entry_id IS NULL") {
		t.Fatalf("pos_sales missing condition %q must include sales without a COGS journal", missingCondition)
	}
}

func TestBakeryOrderBackfillWindowsByEventDate(t *testing.T) {
	_, _, _, _, _, dateColumn, statusColumn, statusValue, _, _ := backfillTargetQuery("bakery_orders")
	// The reports window bakery orders by event_date; a backfill windowed by
	// created_at can miss exactly the rows the report flags.
	if dateColumn != "event_date" {
		t.Fatalf("bakery_orders backfill date column = %q, want event_date", dateColumn)
	}
	if statusColumn != "order_status" || statusValue != "completed" {
		t.Fatalf("bakery_orders backfill status = %q/%q, want order_status/completed", statusColumn, statusValue)
	}
}

func TestSaleMovementCostsTargetRegistration(t *testing.T) {
	if !validBackfillTarget("sale_movement_costs") {
		t.Fatal("sale_movement_costs must be an accepted accounting backfill target")
	}
	targets := defaultBackfillTargets()
	repairIndex, posSalesIndex, paymentsIndex := -1, -1, -1
	for i, target := range targets {
		switch target {
		case "sale_movement_costs":
			repairIndex = i
		case "pos_sales":
			posSalesIndex = i
		case "pos_sale_payments":
			paymentsIndex = i
		}
	}
	if repairIndex == -1 {
		t.Fatal("sale_movement_costs must be a default backfill target")
	}
	if repairIndex > posSalesIndex {
		t.Fatal("sale_movement_costs must run before pos_sales: COGS posts from the repaired movement costs")
	}
	if paymentsIndex < posSalesIndex {
		t.Fatal("pos_sale_payments must still follow pos_sales: checkout payments are stamped by the sale journal")
	}
}

func TestSaleMovementCostsCandidateQueryShape(t *testing.T) {
	table, _, _, _, _, _, _, _, missingCondition, extraCondition := backfillTargetQuery("sale_movement_costs")
	if table != "stock_movements" {
		t.Fatalf("sale_movement_costs table = %q, want stock_movements", table)
	}
	if !strings.Contains(missingCondition, "COALESCE(total_cost, 0) <= 0") {
		t.Fatalf("sale_movement_costs missing condition %q must select only zero-cost movements", missingCondition)
	}
	for _, required := range []string{
		"movement_type = 'sale_out'",
		"accounting_journal_entry_id IS NULL",
		reportshared.SaleRevenueCondition("s"),
	} {
		if !strings.Contains(extraCondition, required) {
			t.Fatalf("sale_movement_costs extra condition %q must contain %q", extraCondition, required)
		}
	}
}

func TestBackfillValidationAcceptsSaleMovementCostsDryRun(t *testing.T) {
	service := &Service{}
	req := normalizeBackfillRequest(BackfillJournalsRequest{Targets: []string{"sale_movement_costs"}, DryRun: true})
	if _, err := service.validateBackfillRequest(backfillAuthContext(), req); err != nil {
		t.Fatalf("sale_movement_costs should pass dry-run validation: %v", err)
	}
}
