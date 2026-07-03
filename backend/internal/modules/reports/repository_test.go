package reports

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"pastries-pos/internal/modules/reports/shared"
)

func testBakeryOrdersReportFilter() *shared.ResolvedFilter {
	return &shared.ResolvedFilter{
		BusinessID:  "business-id",
		AllBranches: true,
		StartUTC:    time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		EndUTC:      time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		DateFrom:    time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		DateTo:      time.Date(2026, 7, 31, 23, 59, 59, 0, time.UTC),
		Page:        1,
		Limit:       25,
	}
}

func TestFinancialPaymentsUnionSQLDefaultsToFinancialImpactStatuses(t *testing.T) {
	query, args := financialPaymentsUnionSQL(testBakeryOrdersReportFilter())

	for _, expected := range []string{"FROM sale_payments sp", "FROM bakery_order_payments bop", "sp.payment_status IN ?"} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected payment union query to contain %q: %s", expected, query)
		}
	}
	statuses, ok := args[3].([]string)
	if !ok {
		t.Fatalf("expected POS status args at args[3], got %T", args[3])
	}
	if !reflect.DeepEqual(statuses, financialImpactPaymentStatuses) {
		t.Fatalf("unexpected financial payment statuses: %#v", statuses)
	}
}

func TestFinancialPaymentsUnionSQLAppliesSourceAndStatusFilters(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	filter.SourceType = "bakery_order"
	filter.Status = "pending"
	query, _ := financialPaymentsUnionSQL(filter)

	if strings.Contains(query, "FROM sale_payments sp") {
		t.Fatalf("source_type=bakery_order should exclude POS payments: %s", query)
	}
	if !strings.Contains(query, "FROM bakery_order_payments bop") || !strings.Contains(query, "AND 1 = 0") {
		t.Fatalf("pending bakery payment filter should produce no completed bakery rows: %s", query)
	}
}

func TestFinancialRefundSummarySQLDefaultsToCompletedAndAppliesSource(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	filter.SourceType = "sales_return"
	query, args := financialRefundSummarySQL(filter)

	for _, expected := range []string{"FROM payment_refunds pr", "pr.refund_status IN ?", "COALESCE(pr.refund_source, 'payment_adjustment') = 'sales_return'"} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected refund summary query to contain %q: %s", expected, query)
		}
	}
	statuses, ok := args[3].([]string)
	if !ok {
		t.Fatalf("expected refund status args at args[3], got %T", args[3])
	}
	if !reflect.DeepEqual(statuses, []string{"completed"}) {
		t.Fatalf("unexpected refund statuses: %#v", statuses)
	}
}

func TestFinancialReconciliationTransactionsSQLUsesTransactionSources(t *testing.T) {
	query, _ := financialReconciliationTransactionsSQL(testBakeryOrdersReportFilter())

	for _, expected := range []string{
		"'collection' AS transaction_type",
		"'refund' AS transaction_type",
		"'pos_sale' AS source_type",
		"'bakery_order' AS source_type",
		"payment_refunds pr",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected reconciliation query to contain %q: %s", expected, query)
		}
	}
	if strings.Contains(query, "payment_reconciliations") {
		t.Fatalf("financial reconciliation report should not use manual reconciliation sessions: %s", query)
	}
}

func TestFinancialReconciliationTransactionsSQLIncludesSupplierOnlyWhenRequested(t *testing.T) {
	defaultQuery, _ := financialReconciliationTransactionsSQL(testBakeryOrdersReportFilter())
	if strings.Contains(defaultQuery, "supplier_payments sp") {
		t.Fatalf("supplier payments should not be included in default customer reconciliation: %s", defaultQuery)
	}

	filter := testBakeryOrdersReportFilter()
	filter.SourceType = "supplier_payment"
	query, _ := financialReconciliationTransactionsSQL(filter)
	if !strings.Contains(query, "supplier_payments sp") {
		t.Fatalf("source_type=supplier_payment should include supplier payment transactions: %s", query)
	}
}

func TestBakeryOrdersUpcomingSQLFiltersActiveStatuses(t *testing.T) {
	query, args, _ := bakeryOrdersUpcomingSQL(testBakeryOrdersReportFilter())

	if !strings.Contains(query, "bo.order_status IN ?") {
		t.Fatalf("expected upcoming orders query to constrain order statuses: %s", query)
	}
	if strings.Contains(query, "completed") || strings.Contains(query, "cancelled") {
		t.Fatalf("upcoming orders query should not hard-code final statuses: %s", query)
	}
	statuses, ok := args[3].([]string)
	if !ok {
		t.Fatalf("expected status filter at args[3], got %T", args[3])
	}
	if !reflect.DeepEqual(statuses, upcomingBakeryOrderStatuses) {
		t.Fatalf("unexpected upcoming statuses: %#v", statuses)
	}
}

func TestBakeryOrdersProductionScheduleSQLIncludesCompletedAndProductionExplanation(t *testing.T) {
	query, args := bakeryOrdersProductionScheduleSQL(testBakeryOrdersReportFilter())

	for _, expected := range []string{
		"LEFT JOIN LATERAL",
		"COALESCE(bop.status,'not_linked') AS production_status",
		"has_production_record",
		"production_batch_status",
		"production_note",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected production schedule query to contain %q: %s", expected, query)
		}
	}
	statuses, ok := args[3].([]string)
	if !ok {
		t.Fatalf("expected status filter at args[3], got %T", args[3])
	}
	if !reflect.DeepEqual(statuses, productionScheduleBakeryOrderStatuses) {
		t.Fatalf("unexpected production schedule statuses: %#v", statuses)
	}
	for _, excluded := range []string{"cancelled"} {
		for _, status := range statuses {
			if status == excluded {
				t.Fatalf("production schedule statuses should not include %q: %#v", excluded, statuses)
			}
		}
	}
}

func TestInventorySummarySQLUsesOperationalInventoryValue(t *testing.T) {
	query, _ := inventorySummarySQL(testBakeryOrdersReportFilter())

	if !strings.Contains(query, "SUM(ii.inventory_value)") {
		t.Fatalf("inventory summary must sum operational inventory value: %s", query)
	}
	for _, forbidden := range []string{"cost_price", "cost_per_unit", "current_quantity *"} {
		if strings.Contains(query, forbidden) {
			t.Fatalf("inventory summary must not use master-cost valuation %q: %s", forbidden, query)
		}
	}
}

func TestStockValuationRowsSQLUsesOperationalWeightedAverageValue(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	filter.AllBranches = false
	filter.BranchID = "branch-id"
	filter.ItemType = "ingredient"
	filter.Status = "active"
	query, args := stockValuationRowsSQL(filter)

	for _, expected := range []string{
		"COALESCE(ii.average_unit_cost, 0) AS unit_cost",
		"COALESCE(ii.inventory_value, 0) AS stock_value",
		"AND ii.branch_id = ?",
		"AND ii.item_type = ?",
		"AND ii.status = ?",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected stock valuation query to contain %q: %s", expected, query)
		}
	}
	for _, forbidden := range []string{"cost_price", "cost_per_unit", "current_quantity *"} {
		if strings.Contains(query, forbidden) {
			t.Fatalf("stock valuation rows must not use master-cost valuation %q: %s", forbidden, query)
		}
	}
	if !reflect.DeepEqual(args, []interface{}{"business-id", "branch-id", "ingredient", "active"}) {
		t.Fatalf("unexpected stock valuation args: %#v", args)
	}
}

func TestStockValuationByItemTypeSQLUsesOperationalInventoryValue(t *testing.T) {
	query, _ := stockValuationByItemTypeSQL(testBakeryOrdersReportFilter())

	if !strings.Contains(query, "SUM(ii.inventory_value)") {
		t.Fatalf("stock valuation by type must sum operational inventory value: %s", query)
	}
	for _, forbidden := range []string{"cost_price", "cost_per_unit", "current_quantity *"} {
		if strings.Contains(query, forbidden) {
			t.Fatalf("stock valuation by type must not use master-cost valuation %q: %s", forbidden, query)
		}
	}
}
