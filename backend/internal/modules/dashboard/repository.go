package dashboard

import (
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/reports"
	reportshared "pastries-pos/internal/modules/reports/shared"
)

type Repository struct {
	db *gorm.DB
}

type Scope struct {
	BusinessID  string
	BranchID    string
	AllBranches bool
	TodayStart  time.Time
	TodayEnd    time.Time
	MonthStart  time.Time
	MonthEnd    time.Time
	TodayDate   string
	MonthDate   string
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) AdminDashboard(scope Scope, summary *reports.DashboardSummaryResponse, monthlySales float64) (*AdminDashboardResponse, error) {
	outOfStock, err := r.adminOutOfStock(scope)
	warnings := make([]DashboardLoadWarning, 0)
	if err != nil {
		warnings = append(warnings, dashboardLoadWarning(
			"out_of_stock_count",
			"Out-of-stock count could not be loaded.",
			"out_of_stock_count_failed",
			err,
		))
		outOfStock = 0
	}
	customers, err := r.adminCustomers(scope)
	if err != nil {
		warnings = append(warnings, dashboardLoadWarning(
			"customer_count",
			"New customer count could not be loaded.",
			"customer_count_failed",
			err,
		))
		customers = &AdminCustomersWidget{}
	}
	inProduction, err := r.adminInProductionOrders(scope)
	if err != nil {
		warnings = append(warnings, dashboardLoadWarning(
			"in_production_orders",
			"In-production order count could not be loaded.",
			"in_production_orders_failed",
			err,
		))
		inProduction = 0
	}
	outstanding, err := reportshared.LedgerMappedBalance(r.db, dashboardMetricScope(scope), "accounts_receivable", "1100", scope.TodayDate)
	if err != nil {
		warnings = append(warnings, dashboardLoadWarning(
			"outstanding_balance",
			"Outstanding balance could not be loaded.",
			"outstanding_balance_failed",
			err,
		))
		outstanding = 0
	}
	return adminDashboardFromReportSummary(summary, monthlySales, outOfStock, inProduction, outstanding, *customers, warnings), nil
}

func dashboardLoadWarning(segment, message, reason string, err error) DashboardLoadWarning {
	warning := DashboardLoadWarning{
		Segment: segment,
		Message: message,
		Reason:  reason,
	}
	if err != nil && strings.TrimSpace(err.Error()) != "" {
		warning.Message = message + " " + err.Error()
	}
	return warning
}

func adminDashboardFromReportSummary(
	summary *reports.DashboardSummaryResponse,
	monthlySales float64,
	outOfStock int64,
	inProduction int64,
	outstanding float64,
	customers AdminCustomersWidget,
	warnings []DashboardLoadWarning,
) *AdminDashboardResponse {
	return &AdminDashboardResponse{
		Sales: AdminSalesWidget{
			TodaySales: summary.Sales.TotalSales,
			// Computed over the calendar month, not the request window. These
			// two were previously the same value, so "Monthly Sales" only ever
			// showed the selected period.
			MonthlySales:      monthlySales,
			SalesCountToday:   summary.Sales.SalesCount,
			AverageOrderValue: summary.Sales.AverageOrderValue,
		},
		Inventory: AdminInventoryWidget{
			LowStockCount:      summary.Inventory.LowStockCount,
			ExpiringItemsCount: summary.Inventory.ExpiringItemsCount,
			OutOfStockCount:    outOfStock,
		},
		Orders: AdminOrdersWidget{
			PendingOrders:      summary.Orders.PendingOrders,
			InProductionOrders: inProduction,
			ReadyOrders:        summary.Orders.ReadyOrders,
		},
		Manufacturing: AdminManufacturingWidget{
			ActiveBatches:         summary.Manufacturing.ActiveBatches,
			CompletedBatchesToday: summary.Manufacturing.CompletedBatches,
		},
		Financial: AdminFinancialWidget{
			CollectedToday:     summary.Payments.CollectedAmount,
			RefundTotalToday:   summary.Payments.RefundAmount,
			OutstandingBalance: outstanding,
		},
		Customers:    customers,
		LoadWarnings: warnings,
	}
}

func kpiSummaryFromReportSummary(summary *reports.DashboardSummaryResponse) *KPISummaryResponse {
	if summary == nil {
		return &KPISummaryResponse{}
	}
	return &KPISummaryResponse{
		TodaySales:        summary.Sales.TotalSales,
		TodayOrders:       summary.Orders.PendingOrders + summary.Orders.ReadyOrders,
		TodayCollected:    summary.Payments.CollectedAmount,
		RefundsToday:      summary.Payments.RefundAmount,
		SalesCountToday:   summary.Sales.SalesCount,
		AverageOrderValue: summary.Sales.AverageOrderValue,
		PendingOrders:     summary.Orders.PendingOrders,
		ReadyOrders:       summary.Orders.ReadyOrders,
		LowStockCount:     summary.Inventory.LowStockCount,
		ExpiringItems:     summary.Inventory.ExpiringItemsCount,
		ActiveBatches:     summary.Manufacturing.ActiveBatches,
		CompletedBatches:  summary.Manufacturing.CompletedBatches,
	}
}

func (r *Repository) CashierDashboard(scope Scope, userID string) (*CashierDashboardResponse, error) {
	sales := CashierSalesWidget{}
	query := "SELECT COALESCE(SUM(total_amount),0) AS today_sales, COUNT(*) AS sales_count FROM sales WHERE business_id = ? AND cashier_user_id = ? AND sold_at >= ? AND sold_at < ? AND sale_status <> 'voided' AND deleted_at IS NULL"
	args := []interface{}{scope.BusinessID, userID, scope.TodayStart, scope.TodayEnd}
	query, args = addScopedBranch(query, args, "branch_id", scope)
	if err := r.db.Raw(query, args...).Scan(&sales).Error; err != nil {
		return nil, err
	}
	refundQuery := "SELECT COUNT(*) FROM payment_refunds WHERE business_id = ? AND created_by_user_id = ? AND refunded_at >= ? AND refunded_at < ? AND refund_status = 'completed' AND deleted_at IS NULL"
	refundArgs := []interface{}{scope.BusinessID, userID, scope.TodayStart, scope.TodayEnd}
	refundQuery, refundArgs = addScopedBranch(refundQuery, refundArgs, "branch_id", scope)
	if err := r.db.Raw(refundQuery, refundArgs...).Scan(&sales.RefundCount).Error; err != nil {
		return nil, err
	}
	orders := CashierOrdersWidget{}
	orderQuery := "SELECT COUNT(*) FILTER (WHERE order_type = 'pickup') AS pickup_ready, COUNT(*) FILTER (WHERE order_type = 'delivery') AS delivery_ready FROM bakery_orders WHERE business_id = ? AND order_status = 'ready' AND deleted_at IS NULL"
	orderArgs := []interface{}{scope.BusinessID}
	orderQuery, orderArgs = addScopedBranch(orderQuery, orderArgs, "branch_id", scope)
	if err := r.db.Raw(orderQuery, orderArgs...).Scan(&orders).Error; err != nil {
		return nil, err
	}
	payments := CashierPaymentsWidget{}
	paymentQuery := "SELECT COALESCE(SUM(amount) FILTER (WHERE payment_method_type_snapshot = 'cash'),0) AS cash_collected, COALESCE(SUM(amount) FILTER (WHERE payment_method_type_snapshot = 'card'),0) AS card_collected FROM sale_payments WHERE business_id = ? AND paid_by_user_id = ? AND paid_at >= ? AND paid_at < ? AND payment_status IN ('completed','partially_refunded','refunded') AND deleted_at IS NULL"
	paymentArgs := []interface{}{scope.BusinessID, userID, scope.TodayStart, scope.TodayEnd}
	paymentQuery, paymentArgs = addScopedBranch(paymentQuery, paymentArgs, "branch_id", scope)
	if err := r.db.Raw(paymentQuery, paymentArgs...).Scan(&payments).Error; err != nil {
		return nil, err
	}
	bakeryPaymentQuery := `
		SELECT COALESCE(SUM(bop.amount) FILTER (WHERE pm.method_type = 'cash'),0) AS cash_collected,
			COALESCE(SUM(bop.amount) FILTER (WHERE pm.method_type = 'card'),0) AS card_collected
		FROM bakery_order_payments bop
		JOIN bakery_orders bo ON bo.id = bop.bakery_order_id
		JOIN payment_methods pm ON pm.id = bop.payment_method_id
		WHERE bop.business_id = ? AND bop.paid_by_user_id = ? AND bop.paid_at >= ? AND bop.paid_at < ? AND bo.deleted_at IS NULL`
	bakeryPaymentArgs := []interface{}{scope.BusinessID, userID, scope.TodayStart, scope.TodayEnd}
	bakeryPaymentQuery, bakeryPaymentArgs = addScopedBranch(bakeryPaymentQuery, bakeryPaymentArgs, "bo.branch_id", scope)
	var bakeryPayments CashierPaymentsWidget
	if err := r.db.Raw(bakeryPaymentQuery, bakeryPaymentArgs...).Scan(&bakeryPayments).Error; err != nil {
		return nil, err
	}
	payments.CashCollected += bakeryPayments.CashCollected
	payments.CardCollected += bakeryPayments.CardCollected
	return &CashierDashboardResponse{Sales: sales, Orders: orders, Payments: payments, ShiftSummary: CashierShiftSummaryWidget{CurrentCollected: payments.CashCollected + payments.CardCollected}}, nil
}

func (r *Repository) ProductionDashboard(scope Scope) (*ProductionDashboardResponse, error) {
	batches := ProductionBatchesWidget{}
	batchQuery := "SELECT COUNT(*) FILTER (WHERE status IN ('draft','planned','in_progress')) AS active_batches, COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?) AS completed_today, COUNT(*) FILTER (WHERE status IN ('draft','planned')) AS pending_batches FROM production_batches WHERE business_id = ? AND deleted_at IS NULL"
	batchArgs := []interface{}{scope.TodayStart, scope.TodayEnd, scope.BusinessID}
	batchQuery, batchArgs = addScopedBranch(batchQuery, batchArgs, "branch_id", scope)
	if err := r.db.Raw(batchQuery, batchArgs...).Scan(&batches).Error; err != nil {
		return nil, err
	}
	ingredients := ProductionIngredientsWidget{}
	ingredientQuery := "SELECT COUNT(*) FILTER (WHERE item_type = 'ingredient' AND available_quantity <= reorder_level) AS low_stock_ingredients FROM inventory_items WHERE business_id = ? AND deleted_at IS NULL"
	ingredientArgs := []interface{}{scope.BusinessID}
	ingredientQuery, ingredientArgs = addScopedBranch(ingredientQuery, ingredientArgs, "branch_id", scope)
	if err := r.db.Raw(ingredientQuery, ingredientArgs...).Scan(&ingredients).Error; err != nil {
		return nil, err
	}
	expiryQuery := "SELECT COUNT(*) FROM expiry_batches eb JOIN inventory_items ii ON ii.id = eb.inventory_item_id WHERE eb.business_id = ? AND ii.item_type = 'ingredient' AND eb.status = 'active' AND eb.deleted_at IS NULL AND eb.expiry_date > ?::date AND eb.expiry_date <= ?::date + INTERVAL '7 days'"
	expiryArgs := []interface{}{scope.BusinessID, scope.TodayDate, scope.TodayDate}
	expiryQuery, expiryArgs = addScopedBranch(expiryQuery, expiryArgs, "eb.branch_id", scope)
	if err := r.db.Raw(expiryQuery, expiryArgs...).Scan(&ingredients.ExpiringIngredients).Error; err != nil {
		return nil, err
	}
	orders := ProductionOrdersWidget{}
	orderQuery := "SELECT COUNT(*) FILTER (WHERE order_status = 'confirmed') AS orders_waiting_production, COUNT(*) FILTER (WHERE event_date = ?) AS orders_due_today FROM bakery_orders WHERE business_id = ? AND order_status IN ('confirmed','in_production') AND deleted_at IS NULL"
	orderArgs := []interface{}{scope.TodayDate, scope.BusinessID}
	orderQuery, orderArgs = addScopedBranch(orderQuery, orderArgs, "branch_id", scope)
	if err := r.db.Raw(orderQuery, orderArgs...).Scan(&orders).Error; err != nil {
		return nil, err
	}
	wastage := ProductionWastageWidget{}
	wastageQuery := "SELECT COALESCE(SUM(wastage_quantity),0) AS today_wastage_quantity FROM production_batches WHERE business_id = ? AND production_date = ? AND deleted_at IS NULL"
	wastageArgs := []interface{}{scope.BusinessID, scope.TodayDate}
	wastageQuery, wastageArgs = addScopedBranch(wastageQuery, wastageArgs, "branch_id", scope)
	if err := r.db.Raw(wastageQuery, wastageArgs...).Scan(&wastage).Error; err != nil {
		return nil, err
	}
	return &ProductionDashboardResponse{Batches: batches, Ingredients: ingredients, Orders: orders, Wastage: wastage}, nil
}

func (r *Repository) PurchasingDashboard(scope Scope) (*PurchasingDashboardResponse, error) {
	purchasing := PurchasingWidget{}
	query := "SELECT COUNT(*) FILTER (WHERE po.status IN ('draft','ordered','partially_received')) AS open_purchase_orders FROM purchase_orders po WHERE po.business_id = ? AND po.deleted_at IS NULL"
	args := []interface{}{scope.BusinessID}
	query, args = addScopedBranch(query, args, "po.branch_id", scope)
	if err := r.db.Raw(query, args...).Scan(&purchasing).Error; err != nil {
		return nil, err
	}
	receiptQuery := "SELECT COUNT(*) FROM purchase_receipts pr WHERE pr.business_id = ? AND pr.status = 'draft' AND pr.deleted_at IS NULL"
	receiptArgs := []interface{}{scope.BusinessID}
	receiptQuery, receiptArgs = addScopedBranch(receiptQuery, receiptArgs, "pr.branch_id", scope)
	if err := r.db.Raw(receiptQuery, receiptArgs...).Scan(&purchasing.PendingReceipts).Error; err != nil {
		return nil, err
	}
	payable, err := reportshared.LedgerMappedBalance(r.db, dashboardMetricScope(scope), "accounts_payable", "2000", scope.TodayDate)
	if err != nil {
		return nil, err
	}
	purchasing.SupplierPayables = payable
	inventory := PurchasingInventoryWidget{}
	inventoryQuery := "SELECT COUNT(*) FILTER (WHERE available_quantity <= reorder_level) AS low_stock_items, COUNT(*) FILTER (WHERE available_quantity <= 0) AS critical_low_stock_items FROM inventory_items WHERE business_id = ? AND deleted_at IS NULL"
	inventoryArgs := []interface{}{scope.BusinessID}
	inventoryQuery, inventoryArgs = addScopedBranch(inventoryQuery, inventoryArgs, "branch_id", scope)
	if err := r.db.Raw(inventoryQuery, inventoryArgs...).Scan(&inventory).Error; err != nil {
		return nil, err
	}
	suppliers := PurchasingSuppliersWidget{}
	supplierQuery := "SELECT COUNT(*) FROM suppliers WHERE business_id = ? AND status = 'active' AND deleted_at IS NULL"
	supplierArgs := []interface{}{scope.BusinessID}
	supplierQuery, supplierArgs = addScopedBranch(supplierQuery, supplierArgs, "branch_id", scope)
	if err := r.db.Raw(supplierQuery, supplierArgs...).Scan(&suppliers.ActiveSuppliers).Error; err != nil {
		return nil, err
	}
	return &PurchasingDashboardResponse{Purchasing: purchasing, Inventory: inventory, Suppliers: suppliers}, nil
}

func (r *Repository) RecentActivity(scope Scope, limit int) ([]ActivityFeedItem, error) {
	items := []ActivityFeedItem{}
	query := `
		SELECT COALESCE(NULLIF(event_type,''), action_type) AS activity_type,
			COALESCE(NULLIF(summary,''), action_type) AS title,
			COALESCE(NULLIF(summary,''), action_type) AS description,
			'' AS reference_number,
			'' AS record_label,
			COALESCE(NULLIF(entity_type,''), module_name) AS entity_type,
			'' AS module_label,
			COALESCE(u.full_name,'System') AS created_by,
			a.created_at::text AS created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.actor_user_id
		WHERE a.business_id = ?
		ORDER BY a.created_at DESC
		LIMIT ?`
	if err := r.db.Raw(query, scope.BusinessID, limit).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Alerts(scope Scope) (*AlertsResponse, error) {
	response := &AlertsResponse{}
	lowQuery := `
		SELECT COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') AS item_name,
			ii.available_quantity,
			ii.reorder_level
		FROM inventory_items ii
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE ii.business_id = ? AND ii.available_quantity <= ii.reorder_level AND ii.deleted_at IS NULL`
	lowArgs := []interface{}{scope.BusinessID}
	lowQuery, lowArgs = addScopedBranch(lowQuery, lowArgs, "ii.branch_id", scope)
	lowQuery += " ORDER BY ii.available_quantity ASC LIMIT 10"
	if err := r.db.Raw(lowQuery, lowArgs...).Scan(&response.LowStockAlerts).Error; err != nil {
		return nil, err
	}
	expiryQuery := `
		SELECT COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') AS item_name,
			eb.expiry_date::text AS expiry_date,
			(eb.expiry_date - ?::date)::int AS days_remaining,
			CASE
				WHEN eb.expiry_date < ?::date THEN 'expired'
				WHEN eb.expiry_date = ?::date THEN 'expires_today'
				ELSE 'expiring_soon'
			END AS expiry_state,
			CASE
				WHEN eb.expiry_date < ?::date THEN 'Expired / Overdue'
				WHEN eb.expiry_date = ?::date THEN 'Expires Today'
				ELSE 'Expiring Soon'
			END AS expiry_state_label
		FROM expiry_batches eb
		JOIN inventory_items ii ON ii.id = eb.inventory_item_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE eb.business_id = ? AND eb.status = 'active' AND eb.deleted_at IS NULL AND eb.expiry_date <= ?::date + INTERVAL '7 days'`
	expiryArgs := []interface{}{scope.TodayDate, scope.TodayDate, scope.TodayDate, scope.TodayDate, scope.TodayDate, scope.BusinessID, scope.TodayDate}
	expiryQuery, expiryArgs = addScopedBranch(expiryQuery, expiryArgs, "eb.branch_id", scope)
	expiryQuery += " ORDER BY eb.expiry_date ASC LIMIT 10"
	if err := r.db.Raw(expiryQuery, expiryArgs...).Scan(&response.ExpiryAlerts).Error; err != nil {
		return nil, err
	}
	orderQuery := "SELECT order_number, event_date::text AS event_date, order_status FROM bakery_orders WHERE business_id = ? AND order_status IN ('new','confirmed','in_production') AND deleted_at IS NULL"
	orderArgs := []interface{}{scope.BusinessID}
	orderQuery, orderArgs = addScopedBranch(orderQuery, orderArgs, "branch_id", scope)
	orderQuery += " ORDER BY event_date ASC LIMIT 10"
	if err := r.db.Raw(orderQuery, orderArgs...).Scan(&response.PendingOrderAlerts).Error; err != nil {
		return nil, err
	}
	// Same outstanding scope as the reports and the AR reconciliation, so a
	// cancelled order can no longer show up as a payment alert.
	paymentQuery := "SELECT order_number, balance_amount FROM bakery_orders WHERE business_id = ? AND deleted_at IS NULL AND " + reportshared.OutstandingBakeryOrderCondition("")
	paymentArgs := []interface{}{scope.BusinessID}
	paymentQuery, paymentArgs = addScopedBranch(paymentQuery, paymentArgs, "branch_id", scope)
	paymentQuery += " ORDER BY balance_amount DESC LIMIT 10"
	if err := r.db.Raw(paymentQuery, paymentArgs...).Scan(&response.OutstandingPaymentAlerts).Error; err != nil {
		return nil, err
	}
	delayQuery := "SELECT production_batch_number AS batch_number, completed_at::text AS expected_end_time, status FROM production_batches WHERE business_id = ? AND status = 'in_progress' AND production_date < ? AND deleted_at IS NULL"
	delayArgs := []interface{}{scope.BusinessID, scope.TodayDate}
	delayQuery, delayArgs = addScopedBranch(delayQuery, delayArgs, "branch_id", scope)
	delayQuery += " ORDER BY production_date ASC LIMIT 10"
	if err := r.db.Raw(delayQuery, delayArgs...).Scan(&response.ProductionDelayAlerts).Error; err != nil {
		return nil, err
	}
	return response, nil
}

func (r *Repository) adminOutOfStock(scope Scope) (int64, error) {
	var total int64
	query := "SELECT COUNT(*) FROM inventory_items WHERE business_id = ? AND deleted_at IS NULL AND available_quantity <= 0"
	args := []interface{}{scope.BusinessID}
	query, args = addScopedBranch(query, args, "branch_id", scope)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) adminInProductionOrders(scope Scope) (int64, error) {
	var total int64
	query := "SELECT COUNT(*) FROM bakery_orders WHERE business_id = ? AND order_status = 'in_production' AND event_date >= ? AND event_date <= ? AND deleted_at IS NULL"
	args := []interface{}{scope.BusinessID, scope.MonthDate, scope.TodayDate}
	query, args = addScopedBranch(query, args, "branch_id", scope)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) adminCustomers(scope Scope) (*AdminCustomersWidget, error) {
	var row AdminCustomersWidget
	query := "SELECT COUNT(*) FROM customers WHERE business_id = ? AND created_at >= ? AND created_at < ? AND deleted_at IS NULL"
	args := []interface{}{scope.BusinessID, scope.TodayStart, scope.TodayEnd}
	query, args = addScopedBranch(query, args, "branch_id", scope)
	err := r.db.Raw(query, args...).Scan(&row.NewCustomersToday).Error
	return &row, err
}

func addScopedBranch(query string, args []interface{}, column string, scope Scope) (string, []interface{}) {
	if !scope.AllBranches {
		query += " AND " + column + " = ?"
		args = append(args, scope.BranchID)
	}
	return query, args
}

func dashboardMetricScope(scope Scope) reportshared.MetricScope {
	return reportshared.MetricScope{
		BusinessID:  scope.BusinessID,
		BranchID:    scope.BranchID,
		AllBranches: scope.AllBranches,
	}
}

func roundDashboardMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
