package dashboard

import (
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

	admin := adminDashboardFromReportSummary(
		summary,
		8,
		9,
		300.50,
		AdminCustomersWidget{NewCustomersToday: 10},
	)

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
