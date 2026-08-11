package dashboard

import (
	"errors"
	"net/http"
	"net/url"
	"testing"
	"time"

	"pastries-pos/internal/modules/reports"
	reportshared "pastries-pos/internal/modules/reports/shared"
	"pastries-pos/internal/shared/utils"
)

func TestAdminDashboardUsesReportsSummaryForComparableMetrics(t *testing.T) {
	summary := &reports.DashboardSummaryResponse{
		Sales: reports.SalesSummary{
			TotalSales:        1234.56,
			SalesCount:        12,
			AverageOrderValue: 102.88,
		},
		Inventory: reports.InventorySummary{
			LowStockCount:      4,
			ExpiringItemsCount: 7,
		},
		Manufacturing: reports.ManufacturingSummary{
			ActiveBatches:    3,
			CompletedBatches: 2,
		},
		Orders: reports.OrdersSummary{
			PendingOrders: 5,
			ReadyOrders:   6,
		},
		Payments: reports.PaymentsSummary{
			CollectedAmount: 900.25,
			RefundAmount:    45.75,
		},
	}

	const monthlySales = 5400.00
	admin := adminDashboardFromReportSummary(
		summary,
		monthlySales,
		8,
		9,
		300.50,
		AdminCustomersWidget{NewCustomersToday: 10},
		nil,
	)

	// Monthly sales come from their own month-to-date query. They used to be
	// copied from the request window, so the tile never showed a month.
	if admin.Sales.MonthlySales != monthlySales {
		t.Fatalf("monthly sales = %.2f, want %.2f", admin.Sales.MonthlySales, monthlySales)
	}
	if admin.Sales.MonthlySales == admin.Sales.TodaySales {
		t.Fatal("monthly sales must not be the same value as today's sales")
	}

	if admin.Sales.TodaySales != summary.Sales.TotalSales {
		t.Fatalf("admin sales must match reports summary sales: got %.2f want %.2f", admin.Sales.TodaySales, summary.Sales.TotalSales)
	}
	if admin.Sales.SalesCountToday != summary.Sales.SalesCount {
		t.Fatalf("admin sales count must match reports summary: got %d want %d", admin.Sales.SalesCountToday, summary.Sales.SalesCount)
	}
	if admin.Sales.AverageOrderValue != summary.Sales.AverageOrderValue {
		t.Fatalf("admin average order must match reports summary: got %.2f want %.2f", admin.Sales.AverageOrderValue, summary.Sales.AverageOrderValue)
	}
	if admin.Financial.CollectedToday != summary.Payments.CollectedAmount {
		t.Fatalf("admin collections must match reports summary: got %.2f want %.2f", admin.Financial.CollectedToday, summary.Payments.CollectedAmount)
	}
	if admin.Financial.RefundTotalToday != summary.Payments.RefundAmount {
		t.Fatalf("admin refunds must match reports summary: got %.2f want %.2f", admin.Financial.RefundTotalToday, summary.Payments.RefundAmount)
	}
	if admin.Inventory.LowStockCount != summary.Inventory.LowStockCount || admin.Inventory.ExpiringItemsCount != summary.Inventory.ExpiringItemsCount {
		t.Fatalf("admin inventory risk must match reports summary: got %#v want %#v", admin.Inventory, summary.Inventory)
	}
	if admin.Orders.PendingOrders != summary.Orders.PendingOrders || admin.Orders.ReadyOrders != summary.Orders.ReadyOrders {
		t.Fatalf("admin order counts must match reports summary: got %#v want %#v", admin.Orders, summary.Orders)
	}
	if admin.Manufacturing.ActiveBatches != summary.Manufacturing.ActiveBatches || admin.Manufacturing.CompletedBatchesToday != summary.Manufacturing.CompletedBatches {
		t.Fatalf("admin manufacturing counts must match reports summary: got %#v want %#v", admin.Manufacturing, summary.Manufacturing)
	}
}

func TestAdminDashboardFromReportSummaryPreservesLoadWarnings(t *testing.T) {
	summary := &reports.DashboardSummaryResponse{}
	warnings := []DashboardLoadWarning{
		{
			Segment: "outstanding_balance",
			Message: "Outstanding balance could not be loaded.",
			Reason:  "outstanding_balance_failed",
		},
	}

	admin := adminDashboardFromReportSummary(
		summary,
		0,
		0,
		0,
		0,
		AdminCustomersWidget{},
		warnings,
	)

	if len(admin.LoadWarnings) != 1 {
		t.Fatalf("LoadWarnings length = %d, want 1", len(admin.LoadWarnings))
	}
	if admin.LoadWarnings[0].Segment != "outstanding_balance" || admin.LoadWarnings[0].Reason != "outstanding_balance_failed" {
		t.Fatalf("unexpected warning: %#v", admin.LoadWarnings[0])
	}
}

func TestKPISummaryUsesReportsSummaryForComparableMetrics(t *testing.T) {
	summary := &reports.DashboardSummaryResponse{
		Sales: reports.SalesSummary{
			TotalSales:        222.75,
			SalesCount:        3,
			AverageOrderValue: 74.25,
		},
		Inventory: reports.InventorySummary{
			LowStockCount:      4,
			ExpiringItemsCount: 5,
		},
		Manufacturing: reports.ManufacturingSummary{
			ActiveBatches:    6,
			CompletedBatches: 7,
		},
		Orders: reports.OrdersSummary{
			PendingOrders: 8,
			ReadyOrders:   9,
		},
		Payments: reports.PaymentsSummary{
			CollectedAmount: 111.25,
			RefundAmount:    10.50,
		},
	}

	kpi := kpiSummaryFromReportSummary(summary)

	if kpi.TodaySales != summary.Sales.TotalSales {
		t.Fatalf("KPI sales must match reports summary sales: got %.2f want %.2f", kpi.TodaySales, summary.Sales.TotalSales)
	}
	if kpi.TodayCollected != summary.Payments.CollectedAmount {
		t.Fatalf("KPI collections must match reports summary: got %.2f want %.2f", kpi.TodayCollected, summary.Payments.CollectedAmount)
	}
	if kpi.RefundsToday != summary.Payments.RefundAmount {
		t.Fatalf("KPI refunds must match reports summary: got %.2f want %.2f", kpi.RefundsToday, summary.Payments.RefundAmount)
	}
	if kpi.SalesCountToday != summary.Sales.SalesCount {
		t.Fatalf("KPI sales count must match reports summary: got %d want %d", kpi.SalesCountToday, summary.Sales.SalesCount)
	}
	if kpi.AverageOrderValue != summary.Sales.AverageOrderValue {
		t.Fatalf("KPI average order must match reports summary: got %.2f want %.2f", kpi.AverageOrderValue, summary.Sales.AverageOrderValue)
	}
	if kpi.TodayOrders != summary.Orders.PendingOrders+summary.Orders.ReadyOrders {
		t.Fatalf("KPI today orders = %d, want pending + ready orders", kpi.TodayOrders)
	}
	if kpi.LowStockCount != summary.Inventory.LowStockCount || kpi.ExpiringItems != summary.Inventory.ExpiringItemsCount {
		t.Fatalf("KPI inventory must match reports summary: got %#v want %#v", kpi, summary.Inventory)
	}
	if kpi.ActiveBatches != summary.Manufacturing.ActiveBatches || kpi.CompletedBatches != summary.Manufacturing.CompletedBatches {
		t.Fatalf("KPI manufacturing must match reports summary: got %#v want %#v", kpi, summary.Manufacturing)
	}
}

func TestKPISummaryFromNilReportsSummaryReturnsZeroValues(t *testing.T) {
	kpi := kpiSummaryFromReportSummary(nil)

	if *kpi != (KPISummaryResponse{}) {
		t.Fatalf("nil reports summary KPI = %#v, want zero-value response", kpi)
	}
}

func TestAdminDashboardLoadErrorIncludesSegmentAndFilterDetails(t *testing.T) {
	filter := &reportshared.ResolvedFilter{
		BranchID:    "11111111-1111-1111-1111-111111111111",
		AllBranches: false,
		DateFrom:    time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC),
		DateTo:      time.Date(2026, 7, 8, 23, 59, 59, 0, time.UTC),
	}

	err := adminDashboardLoadError(
		"dashboard_summary",
		"dashboard_summary_failed",
		filter,
		errors.New("summary query failed"),
	)

	if err.StatusCode != http.StatusInternalServerError {
		t.Fatalf("StatusCode = %d, want %d", err.StatusCode, http.StatusInternalServerError)
	}
	details, ok := err.Details.(map[string]interface{})
	if !ok {
		t.Fatalf("Details type = %T, want map[string]interface{}", err.Details)
	}
	assertDetail := func(key string, want interface{}) {
		t.Helper()
		if details[key] != want {
			t.Fatalf("details[%q] = %#v, want %#v", key, details[key], want)
		}
	}
	assertDetail("segment", "dashboard_summary")
	assertDetail("reason", "dashboard_summary_failed")
	assertDetail("route", "/api/v1/dashboard/admin")
	assertDetail("scope", "current_branch")
	assertDetail("branch_id", "11111111-1111-1111-1111-111111111111")
	assertDetail("date_from", "2026-07-08")
	assertDetail("date_to", "2026-07-08")
	assertDetail("error", "summary query failed")
}

func TestScopeFromReportFilterUsesBusinessLocalDayBoundaries(t *testing.T) {
	branchID := "11111111-1111-1111-1111-111111111111"
	currentUser := &utils.AuthContext{
		BusinessID:           "22222222-2222-2222-2222-222222222222",
		CanAccessAllBranches: true,
		CurrentBranchID:      &branchID,
		AllowedBranchIDs:     []string{branchID},
	}
	filter, err := reportshared.Resolve(currentUser, reportshared.ParseQuery(url.Values{
		"date_from": []string{"2026-06-25"},
		"date_to":   []string{"2026-06-25"},
		"scope":     []string{"all_branches"},
		"timezone":  []string{"Asia/Dubai"},
	}))
	if err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}

	scope := scopeFromReportFilter(filter)

	if !scope.AllBranches {
		t.Fatal("expected all-branch dashboard scope")
	}
	if scope.TodayDate != "2026-06-25" {
		t.Fatalf("TodayDate = %q, want 2026-06-25", scope.TodayDate)
	}
	wantStart := time.Date(2026, 6, 24, 20, 0, 0, 0, time.UTC)
	wantEnd := time.Date(2026, 6, 25, 20, 0, 0, 0, time.UTC)
	if !scope.TodayStart.Equal(wantStart) || !scope.TodayEnd.Equal(wantEnd) {
		t.Fatalf("UTC bounds = %s..%s, want %s..%s", scope.TodayStart, scope.TodayEnd, wantStart, wantEnd)
	}
}
