package reports

import (
	"os"
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

func TestExpiryReportSQLUsesBusinessDateParameter(t *testing.T) {
	source, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read reports repository source: %v", err)
	}
	if strings.Contains(string(source), "CURRENT_DATE") {
		t.Fatal("expiry report SQL should use the resolved business-local date instead of CURRENT_DATE")
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

func TestFinancialPaymentsByMethodSQLReturnsExplicitTransactionCounts(t *testing.T) {
	query, _ := financialPaymentsByMethodSQL(testBakeryOrdersReportFilter())

	for _, expected := range []string{
		"COUNT(*) AS refund_transaction_count",
		"COUNT(*) AS gross_transaction_count",
		"COALESCE(collected.gross_transaction_count,0) AS transaction_count",
		"COALESCE(collected.gross_transaction_count,0) AS gross_transaction_count",
		"COALESCE(refunds.refund_transaction_count,0) AS refund_transaction_count",
		"GREATEST(COALESCE(collected.gross_transaction_count,0) - COALESCE(refunds.refund_transaction_count,0), 0) AS net_transaction_count",
		"FULL OUTER JOIN",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected payment method query to contain %q: %s", expected, query)
		}
	}
}

func TestFinancialSummarySQLUsesOperationalFinancialSources(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	collectedQuery, _ := financialCollectedSummarySQL(filter)
	refundQuery, _ := financialRefundSummarySQL(filter)
	grossSalesQuery, _ := financialGrossSalesSummarySQL(filter)
	outstandingQuery, _ := financialOutstandingSummarySQL(filter)
	purchaseQuery, _ := financialPurchaseTotalSummarySQL(filter)

	for _, expected := range []string{
		"FROM sale_payments sp",
		"FROM bakery_order_payments bop",
		"COUNT(*) AS payment_count",
		"cash_collected",
		"card_collected",
		"bank_transfer_collected",
	} {
		if !strings.Contains(collectedQuery, expected) {
			t.Fatalf("expected collected summary query to contain %q: %s", expected, collectedQuery)
		}
	}
	for _, expected := range []string{"FROM payment_refunds pr", "pr.refund_status IN ?", "COUNT(*) AS refund_count"} {
		if !strings.Contains(refundQuery, expected) {
			t.Fatalf("expected refund summary query to contain %q: %s", expected, refundQuery)
		}
	}
	for name, query := range map[string]string{
		"collected":   collectedQuery,
		"refund":      refundQuery,
		"gross_sales": grossSalesQuery,
		"outstanding": outstandingQuery,
		"purchase":    purchaseQuery,
	} {
		if strings.Contains(query, "journal_entries") || strings.Contains(query, "journal_entry_lines") {
			t.Fatalf("%s summary query must not use journal tables: %s", name, query)
		}
	}
}

func TestDashboardPaymentsSummaryUsesOperationalFinancialSources(t *testing.T) {
	source, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read reports repository source: %v", err)
	}
	repositorySource := string(source)
	start := strings.Index(repositorySource, "func (r *Repository) paymentsSummary")
	if start < 0 {
		t.Fatal("paymentsSummary function not found")
	}
	end := strings.Index(repositorySource[start:], "func (r *Repository) salesExportRows")
	if end < 0 {
		t.Fatal("paymentsSummary end marker not found")
	}
	body := repositorySource[start : start+end]

	for _, expected := range []string{"financialCollectedSummarySQL", "financialRefundSummarySQL"} {
		if !strings.Contains(body, expected) {
			t.Fatalf("dashboard payment summary must use %s: %s", expected, body)
		}
	}
	if strings.Contains(body, "ledgerFinancialTotals") {
		t.Fatalf("dashboard payment summary must not use ledger totals: %s", body)
	}
}

func TestFinancialSummarySalesReturnSourceAffectsRefundsOnly(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	filter.SourceType = "sales_return"

	collectedQuery, _ := financialCollectedSummarySQL(filter)
	refundQuery, _ := financialRefundSummarySQL(filter)
	grossSalesQuery, _ := financialGrossSalesSummarySQL(filter)
	outstandingQuery, _ := financialOutstandingSummarySQL(filter)

	if strings.Contains(collectedQuery, "FROM sale_payments sp") || strings.Contains(collectedQuery, "FROM bakery_order_payments bop") {
		t.Fatalf("sales_return summary collections should not include payment collections: %s", collectedQuery)
	}
	if !strings.Contains(refundQuery, "COALESCE(pr.refund_source, 'payment_adjustment') = 'sales_return'") {
		t.Fatalf("sales_return summary refunds must filter to sales return refunds: %s", refundQuery)
	}
	if !strings.Contains(grossSalesQuery, "SELECT 0::numeric AS gross_sales") {
		t.Fatalf("sales_return summary gross sales should be zero-only: %s", grossSalesQuery)
	}
	if !strings.Contains(outstandingQuery, "WHERE 1 = 0") {
		t.Fatalf("sales_return summary outstanding balances should be empty: %s", outstandingQuery)
	}
}

func TestFinancialPurchaseTotalSummarySQLAppliesBranchAndSource(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	filter.AllBranches = false
	filter.BranchID = "branch-id"
	query, args := financialPurchaseTotalSummarySQL(filter)

	for _, expected := range []string{"FROM purchase_invoices", "status = 'posted'", "AND branch_id = ?"} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected purchase total summary query to contain %q: %s", expected, query)
		}
	}
	if !reflect.DeepEqual(args, []interface{}{"business-id", "2026-07-01", "2026-07-31", "branch-id"}) {
		t.Fatalf("unexpected purchase summary args: %#v", args)
	}

	filter.SourceType = "pos_sale"
	query, args = financialPurchaseTotalSummarySQL(filter)
	if !strings.Contains(query, "SELECT 0::numeric") || len(args) != 0 {
		t.Fatalf("non-purchase source should zero purchase totals, query=%s args=%#v", query, args)
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

func TestSalesRefundAllocationsSQLUsesCompletedRefundsByRefundDate(t *testing.T) {
	filter := testBakeryOrdersReportFilter()
	filter.AllBranches = false
	filter.BranchID = "branch-id"
	filter.CashierUserID = "cashier-id"
	filter.PaymentStatus = "partially_refunded"
	filter.SaleStatus = "partially_refunded"
	filter.ProductID = "product-id"
	filter.CategoryID = "category-id"

	query, args := salesRefundAllocationsSQL(filter, filter.StartUTC, filter.EndUTC)

	for _, expected := range []string{
		"FROM payment_refunds pr",
		"pr.refunded_at >= ?",
		"pr.refunded_at < ?",
		"pr.refund_status = 'completed'",
		"JOIN sales_return_items sri",
		"NOT EXISTS",
		"pr.refund_amount * (si.line_total / COALESCE(NULLIF(s.total_amount, 0), NULLIF(sale_totals.sale_total, 0)))",
		"AND branch_id = ?",
		"AND cashier_user_id = ?",
		"AND payment_status = ?",
		"AND sale_status = ?",
		"AND product_id = ?",
		"AND category_id = ?",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected refund allocation query to contain %q: %s", expected, query)
		}
	}
	if len(args) != 12 {
		t.Fatalf("unexpected refund allocation arg count: %#v", args)
	}
}

func TestSalesRefundTotalsByBucketUsesRefundedAtBucket(t *testing.T) {
	query, _ := salesRefundAllocationsSQL(testBakeryOrdersReportFilter(), testBakeryOrdersReportFilter().StartUTC, testBakeryOrdersReportFilter().EndUTC)

	if strings.Contains(query, "sr.return_date >= ?") {
		t.Fatalf("sales refund allocations must not bucket by sales return date: %s", query)
	}
	if !strings.Contains(query, "pr.refunded_at >= ?") {
		t.Fatalf("sales refund allocations must use payment refund date: %s", query)
	}
}

func TestSlowMovingProductsSQLFiltersSellableVisibleActiveProducts(t *testing.T) {
	query, args := slowMovingProductsSQL(testBakeryOrdersReportFilter())

	for _, expected := range []string{
		"p.status = 'active'",
		"p.is_sellable = TRUE",
		"p.is_pos_visible = TRUE",
		"p.deleted_at IS NULL",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected slow moving products query to contain %q: %s", expected, query)
		}
	}
	if len(args) != 6 {
		t.Fatalf("unexpected slow moving products arg count: %#v", args)
	}
}
