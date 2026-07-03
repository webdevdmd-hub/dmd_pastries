package reports

import "github.com/gin-gonic/gin"

func RegisterRoutes(
	router *gin.Engine,
	handler *Handler,
	authGuard gin.HandlerFunc,
	view gin.HandlerFunc,
	inventoryView gin.HandlerFunc,
	manufacturingView gin.HandlerFunc,
	ordersView gin.HandlerFunc,
	export gin.HandlerFunc,
) {
	group := router.Group("/api/v1/reports")
	group.Use(authGuard)

	group.GET("/dashboard/summary", view, handler.DashboardSummary)
	group.GET("/chart/sales", view, handler.SalesChart)
	group.GET("/chart/payments", view, handler.PaymentsChart)
	group.GET("/chart/orders", view, handler.OrdersChart)
	group.GET("/sales/summary", view, handler.SalesSummary)
	group.GET("/sales/daily", view, handler.DailySales)
	group.GET("/sales/by-product", view, handler.SalesByProduct)
	group.GET("/sales/by-category", view, handler.SalesByCategory)
	group.GET("/sales/by-cashier", view, handler.SalesByCashier)
	group.GET("/sales/by-branch", view, handler.SalesByBranch)
	group.GET("/sales/discounts", view, handler.SalesDiscounts)
	group.GET("/sales/taxes", view, handler.SalesTaxes)
	group.GET("/sales/top-products", view, handler.TopProducts)
	group.GET("/sales/slow-moving-products", view, handler.SlowMovingProducts)
	group.GET("/sales/trend", view, handler.SalesTrend)
	group.GET("/receipts", view, handler.ReceiptRecords)
	group.GET("/inventory/summary", view, inventoryView, handler.InventorySummary)
	group.GET("/inventory/current-stock", view, inventoryView, handler.CurrentStock)
	group.GET("/inventory/stock-valuation", view, inventoryView, handler.StockValuation)
	group.GET("/inventory/low-stock", view, inventoryView, handler.LowStock)
	group.GET("/inventory/expiry", view, inventoryView, handler.ExpiryReport)
	group.GET("/inventory/movements", view, inventoryView, handler.InventoryMovements)
	group.GET("/inventory/wastage", view, inventoryView, handler.WastageReport)
	group.GET("/inventory/packaging-stock", view, inventoryView, handler.PackagingStock)
	group.GET("/inventory/audit", view, inventoryView, handler.InventoryAudit)
	group.GET("/inventory/trend", view, inventoryView, handler.InventoryTrend)
	group.GET("/manufacturing/summary", view, manufacturingView, handler.ManufacturingSummary)
	group.GET("/manufacturing/batches", view, manufacturingView, handler.ManufacturingBatches)
	group.GET("/manufacturing/ingredient-consumption", view, manufacturingView, handler.ManufacturingIngredientConsumption)
	group.GET("/manufacturing/yield-variance", view, manufacturingView, handler.ManufacturingYieldVariance)
	group.GET("/manufacturing/wastage", view, manufacturingView, handler.ManufacturingWastage)
	group.GET("/manufacturing/recipe-costs", view, manufacturingView, handler.ManufacturingRecipeCosts)
	group.GET("/manufacturing/trend", view, manufacturingView, handler.ManufacturingTrend)
	group.GET("/bakery-orders/summary", view, ordersView, handler.BakeryOrdersSummary)
	group.GET("/bakery-orders/upcoming", view, ordersView, handler.BakeryOrdersUpcoming)
	group.GET("/bakery-orders/status", view, ordersView, handler.BakeryOrdersStatus)
	group.GET("/bakery-orders/production-schedule", view, ordersView, handler.BakeryOrdersProductionSchedule)
	group.GET("/bakery-orders/pending-payments", view, ordersView, handler.BakeryOrdersPendingPayments)
	group.GET("/bakery-orders/delivery-vs-pickup", view, ordersView, handler.BakeryOrdersDeliveryVsPickup)
	group.GET("/bakery-orders/trend", view, ordersView, handler.BakeryOrdersTrend)
	group.GET("/financial/summary", view, handler.FinancialSummary)
	group.GET("/financial/payments", view, handler.FinancialPayments)
	group.GET("/financial/by-payment-method", view, handler.FinancialByPaymentMethod)
	group.GET("/financial/refunds", view, handler.FinancialRefunds)
	group.GET("/financial/outstanding-balances", view, handler.FinancialOutstandingBalances)
	group.GET("/financial/supplier-payables", view, handler.FinancialSupplierPayables)
	group.GET("/financial/purchase-totals", view, handler.FinancialPurchaseTotals)
	group.GET("/financial/reconciliation", view, handler.FinancialReconciliation)
	group.GET("/financial/trend", view, handler.FinancialTrend)
	group.GET("/export/options", export, handler.ExportOptions)
	group.GET("/export/csv", export, handler.ExportCSVGet)
	group.POST("/export/csv", export, handler.ExportCSVPost)
}
