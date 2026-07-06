package dashboard

import (
	"testing"

	"pastries-pos/internal/modules/reports"
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
