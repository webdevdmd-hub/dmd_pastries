package dashboard

type AdminDashboardResponse struct {
	Sales         AdminSalesWidget         `json:"sales"`
	Inventory     AdminInventoryWidget     `json:"inventory"`
	Orders        AdminOrdersWidget        `json:"orders"`
	Manufacturing AdminManufacturingWidget `json:"manufacturing"`
	Financial     AdminFinancialWidget     `json:"financial"`
	Customers     AdminCustomersWidget     `json:"customers"`
	LoadWarnings  []DashboardLoadWarning   `json:"load_warnings,omitempty"`
}

type DashboardLoadWarning struct {
	Segment string `json:"segment"`
	Message string `json:"message"`
	Reason  string `json:"reason"`
}

type AdminSalesWidget struct {
	TodaySales        float64 `json:"today_sales"`
	MonthlySales      float64 `json:"monthly_sales"`
	SalesCountToday   int64   `json:"sales_count_today"`
	AverageOrderValue float64 `json:"average_order_value"`
}

type AdminInventoryWidget struct {
	LowStockCount      int64 `json:"low_stock_count"`
	ExpiringItemsCount int64 `json:"expiring_items_count"`
	OutOfStockCount    int64 `json:"out_of_stock_count"`
}

type AdminOrdersWidget struct {
	PendingOrders      int64 `json:"pending_orders"`
	InProductionOrders int64 `json:"in_production_orders"`
	ReadyOrders        int64 `json:"ready_orders"`
}

type AdminManufacturingWidget struct {
	ActiveBatches         int64 `json:"active_batches"`
	CompletedBatchesToday int64 `json:"completed_batches_today"`
}

type AdminFinancialWidget struct {
	CollectedToday     float64 `json:"collected_today"`
	RefundTotalToday   float64 `json:"refund_total_today"`
	OutstandingBalance float64 `json:"outstanding_balance"`
}

type AdminCustomersWidget struct {
	NewCustomersToday int64 `json:"new_customers_today"`
}

type CashierDashboardResponse struct {
	Sales        CashierSalesWidget        `json:"sales"`
	Orders       CashierOrdersWidget       `json:"orders"`
	Payments     CashierPaymentsWidget     `json:"payments"`
	ShiftSummary CashierShiftSummaryWidget `json:"shift_summary"`
}

type CashierSalesWidget struct {
	TodaySales  float64 `json:"today_sales"`
	SalesCount  int64   `json:"sales_count"`
	RefundCount int64   `json:"refund_count"`
}

type CashierOrdersWidget struct {
	PickupReady   int64 `json:"pickup_ready"`
	DeliveryReady int64 `json:"delivery_ready"`
}

type CashierPaymentsWidget struct {
	CashCollected float64 `json:"cash_collected"`
	CardCollected float64 `json:"card_collected"`
}

type CashierShiftSummaryWidget struct {
	StartTime        *string `json:"start_time"`
	CurrentCollected float64 `json:"current_collected"`
}

type ProductionDashboardResponse struct {
	Batches     ProductionBatchesWidget     `json:"batches"`
	Ingredients ProductionIngredientsWidget `json:"ingredients"`
	Orders      ProductionOrdersWidget      `json:"orders"`
	Wastage     ProductionWastageWidget     `json:"wastage"`
}

type ProductionBatchesWidget struct {
	ActiveBatches  int64 `json:"active_batches"`
	CompletedToday int64 `json:"completed_today"`
	PendingBatches int64 `json:"pending_batches"`
}

type ProductionIngredientsWidget struct {
	LowStockIngredients int64 `json:"low_stock_ingredients"`
	ExpiringIngredients int64 `json:"expiring_ingredients"`
}

type ProductionOrdersWidget struct {
	OrdersWaitingProduction int64 `json:"orders_waiting_production"`
	OrdersDueToday          int64 `json:"orders_due_today"`
}

type ProductionWastageWidget struct {
	TodayWastageQuantity float64 `json:"today_wastage_quantity"`
}

type PurchasingDashboardResponse struct {
	Purchasing PurchasingWidget          `json:"purchasing"`
	Inventory  PurchasingInventoryWidget `json:"inventory"`
	Suppliers  PurchasingSuppliersWidget `json:"suppliers"`
}

type PurchasingWidget struct {
	OpenPurchaseOrders int64   `json:"open_purchase_orders"`
	PendingReceipts    int64   `json:"pending_receipts"`
	SupplierPayables   float64 `json:"supplier_payables"`
}

type PurchasingInventoryWidget struct {
	LowStockItems         int64 `json:"low_stock_items"`
	CriticalLowStockItems int64 `json:"critical_low_stock_items"`
}

type PurchasingSuppliersWidget struct {
	ActiveSuppliers int64 `json:"active_suppliers"`
}

type KPISummaryResponse struct {
	TodaySales     float64 `json:"today_sales"`
	TodayOrders    int64   `json:"today_orders"`
	TodayCollected float64 `json:"today_collected"`
	LowStockCount  int64   `json:"low_stock_count"`
	ActiveBatches  int64   `json:"active_batches"`
}

type ActivityFeedItem struct {
	ActivityType    string `json:"activity_type"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	ReferenceNumber string `json:"reference_number"`
	RecordLabel     string `json:"record_label"`
	EntityType      string `json:"entity_type"`
	ModuleLabel     string `json:"module_label"`
	CreatedBy       string `json:"created_by"`
	CreatedAt       string `json:"created_at"`
}

type AlertsResponse struct {
	LowStockAlerts           []LowStockAlert           `json:"low_stock_alerts"`
	ExpiryAlerts             []ExpiryAlert             `json:"expiry_alerts"`
	PendingOrderAlerts       []PendingOrderAlert       `json:"pending_order_alerts"`
	OutstandingPaymentAlerts []OutstandingPaymentAlert `json:"outstanding_payment_alerts"`
	ProductionDelayAlerts    []ProductionDelayAlert    `json:"production_delay_alerts"`
}

type LowStockAlert struct {
	ItemName          string  `json:"item_name"`
	AvailableQuantity float64 `json:"available_quantity"`
	ReorderLevel      float64 `json:"reorder_level"`
}

type ExpiryAlert struct {
	ItemName         string `json:"item_name"`
	ExpiryDate       string `json:"expiry_date"`
	DaysRemaining    int    `json:"days_remaining"`
	ExpiryState      string `json:"expiry_state"`
	ExpiryStateLabel string `json:"expiry_state_label"`
}

type PendingOrderAlert struct {
	OrderNumber string `json:"order_number"`
	EventDate   string `json:"event_date"`
	OrderStatus string `json:"order_status"`
}

type OutstandingPaymentAlert struct {
	OrderNumber   string  `json:"order_number"`
	BalanceAmount float64 `json:"balance_amount"`
}

type ProductionDelayAlert struct {
	BatchNumber     string  `json:"batch_number"`
	ExpectedEndTime *string `json:"expected_end_time"`
	Status          string  `json:"status"`
}
