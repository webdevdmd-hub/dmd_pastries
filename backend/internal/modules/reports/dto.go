package reports

type DashboardSummaryResponse struct {
	Sales         SalesSummary         `json:"sales"`
	Inventory     InventorySummary     `json:"inventory"`
	Manufacturing ManufacturingSummary `json:"manufacturing"`
	Orders        OrdersSummary        `json:"orders"`
	Payments      PaymentsSummary      `json:"payments"`
}

type SalesSummary struct {
	TotalSales        float64 `json:"total_sales"`
	SalesCount        int64   `json:"sales_count"`
	AverageOrderValue float64 `json:"average_order_value"`
}

type InventorySummary struct {
	LowStockCount      int64 `json:"low_stock_count"`
	ExpiringItemsCount int64 `json:"expiring_items_count"`
}

type ManufacturingSummary struct {
	ActiveBatches    int64 `json:"active_batches"`
	CompletedBatches int64 `json:"completed_batches"`
}

type OrdersSummary struct {
	PendingOrders int64 `json:"pending_orders"`
	ReadyOrders   int64 `json:"ready_orders"`
}

type PaymentsSummary struct {
	CollectedAmount float64 `json:"collected_amount"`
	RefundAmount    float64 `json:"refund_amount"`
}

type CSVExportRequest struct {
	ReportType string                 `json:"report_type" binding:"required,oneof=sales payments orders"`
	Filters    map[string]interface{} `json:"filters"`
}

type SalesReportSummaryResponse struct {
	GrossSales        float64                       `json:"gross_sales"`
	NetSales          float64                       `json:"net_sales"`
	SalesCount        int64                         `json:"sales_count"`
	ItemsSold         float64                       `json:"items_sold"`
	AverageOrderValue float64                       `json:"average_order_value"`
	DiscountTotal     float64                       `json:"discount_total"`
	TaxTotal          float64                       `json:"tax_total"`
	RefundTotal       float64                       `json:"refund_total"`
	VoidedSalesCount  int64                         `json:"voided_sales_count"`
	PreviousPeriod    SalesPreviousPeriodComparison `json:"previous_period"`
}

type SalesPreviousPeriodComparison struct {
	GrossSalesChangePercentage float64 `json:"gross_sales_change_percentage"`
	NetSalesChangePercentage   float64 `json:"net_sales_change_percentage"`
	SalesCountChangePercentage float64 `json:"sales_count_change_percentage"`
}

type DailySalesReportItem struct {
	Date          string  `json:"date"`
	GrossSales    float64 `json:"gross_sales"`
	NetSales      float64 `json:"net_sales"`
	SalesCount    int64   `json:"sales_count"`
	ItemsSold     float64 `json:"items_sold"`
	DiscountTotal float64 `json:"discount_total"`
	TaxTotal      float64 `json:"tax_total"`
}

type ProductSalesReportItem struct {
	ProductID     string  `json:"product_id"`
	ProductName   string  `json:"product_name"`
	SKU           string  `json:"sku"`
	QuantitySold  float64 `json:"quantity_sold"`
	GrossSales    float64 `json:"gross_sales"`
	DiscountTotal float64 `json:"discount_total"`
	TaxTotal      float64 `json:"tax_total"`
	NetSales      float64 `json:"net_sales"`
}

type CategorySalesReportItem struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	QuantitySold float64 `json:"quantity_sold"`
	SalesCount   int64   `json:"sales_count"`
	GrossSales   float64 `json:"gross_sales"`
	NetSales     float64 `json:"net_sales"`
}

type CashierSalesReportItem struct {
	CashierUserID string  `json:"cashier_user_id"`
	CashierName   string  `json:"cashier_name"`
	SalesCount    int64   `json:"sales_count"`
	ItemsSold     float64 `json:"items_sold"`
	GrossSales    float64 `json:"gross_sales"`
	NetSales      float64 `json:"net_sales"`
	RefundCount   int64   `json:"refund_count"`
	VoidCount     int64   `json:"void_count"`
}

type BranchSalesReportItem struct {
	BranchID   string  `json:"branch_id"`
	BranchName string  `json:"branch_name"`
	SalesCount int64   `json:"sales_count"`
	ItemsSold  float64 `json:"items_sold"`
	GrossSales float64 `json:"gross_sales"`
	NetSales   float64 `json:"net_sales"`
	TaxTotal   float64 `json:"tax_total"`
}

type DiscountReportResponse struct {
	TotalDiscount                  float64              `json:"total_discount"`
	SaleLevelDiscount              float64              `json:"sale_level_discount"`
	LineLevelDiscount              float64              `json:"line_level_discount"`
	DiscountedSalesCount           int64                `json:"discounted_sales_count"`
	DiscountPercentageOfGrossSales float64              `json:"discount_percentage_of_gross_sales"`
	Items                          []DiscountReportItem `json:"items"`
}

type DiscountReportItem struct {
	SaleNumber     string  `json:"sale_number"`
	Cashier        string  `json:"cashier"`
	DiscountType   string  `json:"discount_type"`
	DiscountAmount float64 `json:"discount_amount"`
	SaleTotal      float64 `json:"sale_total"`
	SoldAt         string  `json:"sold_at"`
}

type TaxReportItem struct {
	TaxRateID     *string `json:"tax_rate_id"`
	TaxName       string  `json:"tax_name"`
	TaxPercentage float64 `json:"tax_percentage"`
	TaxableAmount float64 `json:"taxable_amount"`
	TaxCollected  float64 `json:"tax_collected"`
	SalesCount    int64   `json:"sales_count"`
}

type SlowMovingProductReportItem struct {
	ProductID    string  `json:"product_id"`
	ProductName  string  `json:"product_name"`
	QuantitySold float64 `json:"quantity_sold"`
	NetSales     float64 `json:"net_sales"`
	LastSoldAt   *string `json:"last_sold_at"`
}

type PaginatedResponse[T any] struct {
	Items      []T         `json:"items"`
	Pagination interface{} `json:"pagination"`
}

type InventoryReportSummaryResponse struct {
	TotalInventoryItems  int64   `json:"total_inventory_items"`
	ActiveInventoryItems int64   `json:"active_inventory_items"`
	LowStockCount        int64   `json:"low_stock_count"`
	OutOfStockCount      int64   `json:"out_of_stock_count"`
	ExpiryTrackedCount   int64   `json:"expiry_tracked_count"`
	ExpiringSoonCount    int64   `json:"expiring_soon_count"`
	TotalStockValue      float64 `json:"total_stock_value"`
}

type CurrentStockReportItem struct {
	InventoryItemID   string  `json:"inventory_item_id"`
	BranchID          string  `json:"branch_id"`
	BranchName        string  `json:"branch_name"`
	ItemType          string  `json:"item_type"`
	ItemName          string  `json:"item_name"`
	ItemCode          string  `json:"item_code"`
	CurrentQuantity   float64 `json:"current_quantity"`
	ReservedQuantity  float64 `json:"reserved_quantity"`
	AvailableQuantity float64 `json:"available_quantity"`
	ReorderLevel      float64 `json:"reorder_level"`
	UnitSymbol        string  `json:"unit_symbol"`
	Status            string  `json:"status"`
	IsLowStock        bool    `json:"is_low_stock"`
	IsOutOfStock      bool    `json:"is_out_of_stock"`
}

type StockValuationReportResponse struct {
	TotalStockValue float64                    `json:"total_stock_value"`
	ByItemType      []StockValueByItemType     `json:"by_item_type"`
	Items           []StockValuationReportItem `json:"items"`
	Pagination      interface{}                `json:"pagination"`
}

type StockValueByItemType struct {
	ItemType   string  `json:"item_type"`
	StockValue float64 `json:"stock_value"`
}

type StockValuationReportItem struct {
	InventoryItemID string  `json:"inventory_item_id"`
	ItemName        string  `json:"item_name"`
	ItemType        string  `json:"item_type"`
	BranchName      string  `json:"branch_name"`
	CurrentQuantity float64 `json:"current_quantity"`
	UnitSymbol      string  `json:"unit_symbol"`
	UnitCost        float64 `json:"unit_cost"`
	StockValue      float64 `json:"stock_value"`
}

type LowStockReportItem struct {
	InventoryItemID   string  `json:"inventory_item_id"`
	ItemName          string  `json:"item_name"`
	BranchName        string  `json:"branch_name"`
	AvailableQuantity float64 `json:"available_quantity"`
	ReorderLevel      float64 `json:"reorder_level"`
	ShortageQuantity  float64 `json:"shortage_quantity"`
	UnitSymbol        string  `json:"unit_symbol"`
}

type ExpiryReportItem struct {
	BatchID         string  `json:"batch_id"`
	InventoryItemID string  `json:"inventory_item_id"`
	ItemName        string  `json:"item_name"`
	BranchName      string  `json:"branch_name"`
	BatchNumber     string  `json:"batch_number"`
	Quantity        float64 `json:"quantity"`
	UnitSymbol      string  `json:"unit_symbol"`
	ReceivedDate    string  `json:"received_date"`
	ExpiryDate      string  `json:"expiry_date"`
	DaysRemaining   int     `json:"days_remaining"`
	Status          string  `json:"status"`
}

type InventoryMovementReportItem struct {
	MovementID        string  `json:"movement_id"`
	Date              string  `json:"date"`
	BranchName        string  `json:"branch_name"`
	ItemName          string  `json:"item_name"`
	ItemType          string  `json:"item_type"`
	MovementType      string  `json:"movement_type"`
	MovementDirection string  `json:"movement_direction"`
	Quantity          float64 `json:"quantity"`
	BeforeQuantity    float64 `json:"before_quantity"`
	AfterQuantity     float64 `json:"after_quantity"`
	UnitSymbol        string  `json:"unit_symbol"`
	ReferenceNumber   string  `json:"reference_number"`
	CreatedBy         string  `json:"created_by"`
}

type WastageReportResponse struct {
	TotalWastageQuantity float64             `json:"total_wastage_quantity"`
	WastageValue         float64             `json:"wastage_value"`
	Items                []WastageReportItem `json:"items"`
}

type WastageReportItem struct {
	ItemName   string  `json:"item_name"`
	ItemType   string  `json:"item_type"`
	BranchName string  `json:"branch_name"`
	Quantity   float64 `json:"quantity"`
	UnitSymbol string  `json:"unit_symbol"`
	Reason     string  `json:"reason"`
	CreatedAt  string  `json:"created_at"`
}

type PackagingStockReportItem struct {
	PackagingItemID   string  `json:"packaging_item_id"`
	PackagingName     string  `json:"packaging_name"`
	CategoryName      string  `json:"category_name"`
	BranchName        string  `json:"branch_name"`
	CurrentQuantity   float64 `json:"current_quantity"`
	AvailableQuantity float64 `json:"available_quantity"`
	ReorderLevel      float64 `json:"reorder_level"`
	UnitSymbol        string  `json:"unit_symbol"`
	CostPerUnit       float64 `json:"cost_per_unit"`
	StockValue        float64 `json:"stock_value"`
	IsLowStock        bool    `json:"is_low_stock"`
}

type InventoryAuditReportItem struct {
	InventoryItemID                 string  `json:"inventory_item_id"`
	ItemName                        string  `json:"item_name"`
	BranchName                      string  `json:"branch_name"`
	CurrentQuantity                 float64 `json:"current_quantity"`
	CalculatedQuantityFromMovements float64 `json:"calculated_quantity_from_movements"`
	Difference                      float64 `json:"difference"`
	IsBalanced                      bool    `json:"is_balanced"`
}

type ManufacturingReportSummaryResponse struct {
	TotalBatches              int64   `json:"total_batches"`
	CompletedBatches          int64   `json:"completed_batches"`
	CancelledBatches          int64   `json:"cancelled_batches"`
	TotalPlannedQuantity      float64 `json:"total_planned_quantity"`
	TotalProducedQuantity     float64 `json:"total_produced_quantity"`
	YieldEfficiencyPercentage float64 `json:"yield_efficiency_percentage"`
	TotalWastageQuantity      float64 `json:"total_wastage_quantity"`
	EstimatedProductionCost   float64 `json:"estimated_production_cost"`
}

type ManufacturingBatchReportItem struct {
	BatchID                   string  `json:"batch_id"`
	BatchNumber               string  `json:"batch_number"`
	ProductName               string  `json:"product_name"`
	RecipeName                string  `json:"recipe_name"`
	BranchName                string  `json:"branch_name"`
	PlannedQuantity           float64 `json:"planned_quantity"`
	ProducedQuantity          float64 `json:"produced_quantity"`
	YieldVariance             float64 `json:"yield_variance"`
	YieldEfficiencyPercentage float64 `json:"yield_efficiency_percentage"`
	Status                    string  `json:"status"`
	StartTime                 string  `json:"start_time"`
	EndTime                   string  `json:"end_time"`
}

type IngredientConsumptionReportItem struct {
	InventoryItemID       string  `json:"inventory_item_id"`
	IngredientName        string  `json:"ingredient_name"`
	BranchName            string  `json:"branch_name"`
	TotalConsumedQuantity float64 `json:"total_consumed_quantity"`
	UnitSymbol            string  `json:"unit_symbol"`
	EstimatedCost         float64 `json:"estimated_cost"`
	BatchCount            int64   `json:"batch_count"`
}

type YieldVarianceReportItem struct {
	BatchNumber        string  `json:"batch_number"`
	ProductName        string  `json:"product_name"`
	PlannedQuantity    float64 `json:"planned_quantity"`
	ProducedQuantity   float64 `json:"produced_quantity"`
	VarianceQuantity   float64 `json:"variance_quantity"`
	VariancePercentage float64 `json:"variance_percentage"`
	BranchName         string  `json:"branch_name"`
}

type ManufacturingWastageReportResponse struct {
	TotalWastageQuantity float64                          `json:"total_wastage_quantity"`
	EstimatedWastageCost float64                          `json:"estimated_wastage_cost"`
	Items                []ManufacturingWastageReportItem `json:"items"`
}

type ManufacturingWastageReportItem struct {
	ItemName    string  `json:"item_name"`
	WastageType string  `json:"wastage_type"`
	Quantity    float64 `json:"quantity"`
	UnitSymbol  string  `json:"unit_symbol"`
	Reason      string  `json:"reason"`
	BatchNumber string  `json:"batch_number"`
	CreatedAt   string  `json:"created_at"`
}

type RecipeCostReportItem struct {
	RecipeID                string  `json:"recipe_id"`
	RecipeName              string  `json:"recipe_name"`
	ProductName             string  `json:"product_name"`
	EstimatedIngredientCost float64 `json:"estimated_ingredient_cost"`
	EstimatedPackagingCost  float64 `json:"estimated_packaging_cost"`
	EstimatedTotalCost      float64 `json:"estimated_total_cost"`
	CostPerYieldUnit        float64 `json:"cost_per_yield_unit"`
	BatchYieldQuantity      float64 `json:"batch_yield_quantity"`
	VersionNumber           int     `json:"version_number"`
	IsActive                bool    `json:"is_active"`
}

type BakeryOrdersReportSummaryResponse struct {
	TotalOrders        int64   `json:"total_orders"`
	PendingOrders      int64   `json:"pending_orders"`
	InProductionOrders int64   `json:"in_production_orders"`
	ReadyOrders        int64   `json:"ready_orders"`
	CompletedOrders    int64   `json:"completed_orders"`
	CancelledOrders    int64   `json:"cancelled_orders"`
	PickupOrders       int64   `json:"pickup_orders"`
	DeliveryOrders     int64   `json:"delivery_orders"`
	TotalOrderValue    float64 `json:"total_order_value"`
	PaidAmount         float64 `json:"paid_amount"`
	BalancePending     float64 `json:"balance_pending"`
}

type UpcomingBakeryOrderReportItem struct {
	OrderID       string  `json:"order_id"`
	OrderNumber   string  `json:"order_number"`
	CustomerName  string  `json:"customer_name"`
	EventDate     string  `json:"event_date"`
	PickupTime    *string `json:"pickup_time"`
	DeliveryTime  *string `json:"delivery_time"`
	OrderType     string  `json:"order_type"`
	OrderStatus   string  `json:"order_status"`
	TotalAmount   float64 `json:"total_amount"`
	BalanceAmount float64 `json:"balance_amount"`
}

type BakeryOrderStatusReportItem struct {
	OrderStatus     string  `json:"order_status"`
	OrdersCount     int64   `json:"orders_count"`
	TotalOrderValue float64 `json:"total_order_value"`
}

type BakeryOrderProductionScheduleItem struct {
	OrderNumber         string  `json:"order_number"`
	ProductName         string  `json:"product_name"`
	EventDate           string  `json:"event_date"`
	ProductionStatus    string  `json:"production_status"`
	AssignedBatchNumber *string `json:"assigned_batch_number"`
	Quantity            float64 `json:"quantity"`
	BranchName          string  `json:"branch_name"`
}

type BakeryOrderPendingPaymentsResponse struct {
	TotalPendingBalance float64                         `json:"total_pending_balance"`
	Orders              []BakeryOrderPendingPaymentItem `json:"orders"`
}

type BakeryOrderPendingPaymentItem struct {
	OrderNumber   string  `json:"order_number"`
	CustomerName  string  `json:"customer_name"`
	TotalAmount   float64 `json:"total_amount"`
	PaidAmount    float64 `json:"paid_amount"`
	BalanceAmount float64 `json:"balance_amount"`
	PaymentStatus string  `json:"payment_status"`
	EventDate     string  `json:"event_date"`
}

type BakeryOrderTypeSummary struct {
	Count      int64   `json:"count"`
	TotalValue float64 `json:"total_value"`
}

type BakeryOrderDeliveryVsPickupResponse struct {
	PickupOrders   BakeryOrderTypeSummary `json:"pickup_orders"`
	DeliveryOrders BakeryOrderTypeSummary `json:"delivery_orders"`
}

type FinancialSummaryResponse struct {
	GrossSales                 float64 `json:"gross_sales"`
	TotalCollected             float64 `json:"total_collected"`
	TotalRefunded              float64 `json:"total_refunded"`
	NetCollected               float64 `json:"net_collected"`
	OutstandingCustomerBalance float64 `json:"outstanding_customer_balance"`
	PurchaseTotal              float64 `json:"purchase_total"`
	SupplierPayableBalance     float64 `json:"supplier_payable_balance"`
	CashCollected              float64 `json:"cash_collected"`
	CardCollected              float64 `json:"card_collected"`
	BankTransferCollected      float64 `json:"bank_transfer_collected"`
	RefundCount                int64   `json:"refund_count"`
	PaymentCount               int64   `json:"payment_count"`
}

type FinancialPaymentReportItem struct {
	PaymentID         string  `json:"payment_id"`
	SourceType        string  `json:"source_type"`
	SourceNumber      string  `json:"source_number"`
	BranchName        string  `json:"branch_name"`
	PaymentMethodName string  `json:"payment_method_name"`
	PaymentMethodType string  `json:"payment_method_type"`
	Amount            float64 `json:"amount"`
	Status            string  `json:"status"`
	ReferenceNumber   *string `json:"reference_number"`
	PaidByUserName    string  `json:"paid_by_user_name"`
	PaidAt            string  `json:"paid_at"`
}

type FinancialPaymentMethodReportItem struct {
	PaymentMethodID   string  `json:"payment_method_id"`
	PaymentMethodName string  `json:"payment_method_name"`
	PaymentMethodType string  `json:"payment_method_type"`
	TotalCollected    float64 `json:"total_collected"`
	TotalRefunded     float64 `json:"total_refunded"`
	NetCollected      float64 `json:"net_collected"`
	TransactionCount  int64   `json:"transaction_count"`
}

type FinancialRefundReportItem struct {
	RefundID          string  `json:"refund_id"`
	SourceType        string  `json:"source_type"`
	SourceNumber      string  `json:"source_number"`
	BranchName        string  `json:"branch_name"`
	PaymentMethodName string  `json:"payment_method_name"`
	RefundAmount      float64 `json:"refund_amount"`
	RefundReason      string  `json:"refund_reason"`
	RefundStatus      string  `json:"refund_status"`
	CreatedByUserName string  `json:"created_by_user_name"`
	RefundedAt        string  `json:"refunded_at"`
}

type OutstandingBalanceReportItem struct {
	SourceType    string  `json:"source_type"`
	SourceNumber  string  `json:"source_number"`
	CustomerName  string  `json:"customer_name"`
	BranchName    string  `json:"branch_name"`
	TotalAmount   float64 `json:"total_amount"`
	PaidAmount    float64 `json:"paid_amount"`
	BalanceAmount float64 `json:"balance_amount"`
	DueDate       string  `json:"due_date"`
	PaymentStatus string  `json:"payment_status"`
}

type SupplierPayableReportItem struct {
	SupplierID         string  `json:"supplier_id"`
	SupplierName       string  `json:"supplier_name"`
	InvoiceCount       int64   `json:"invoice_count"`
	TotalInvoiceAmount float64 `json:"total_invoice_amount"`
	PaidAmount         float64 `json:"paid_amount"`
	PayableBalance     float64 `json:"payable_balance"`
	OldestDueDate      *string `json:"oldest_due_date"`
}

type PurchaseTotalsReportResponse struct {
	TotalPurchaseAmount  float64                    `json:"total_purchase_amount"`
	PaidPurchaseAmount   float64                    `json:"paid_purchase_amount"`
	UnpaidPurchaseAmount float64                    `json:"unpaid_purchase_amount"`
	InvoiceCount         int64                      `json:"invoice_count"`
	BySupplier           []PurchaseTotalsBySupplier `json:"by_supplier"`
}

type PurchaseTotalsBySupplier struct {
	SupplierID          string  `json:"supplier_id"`
	SupplierName        string  `json:"supplier_name"`
	TotalPurchaseAmount float64 `json:"total_purchase_amount"`
	InvoiceCount        int64   `json:"invoice_count"`
}

type ReconciliationReportItem struct {
	ReconciliationID   string  `json:"reconciliation_id"`
	BranchName         string  `json:"branch_name"`
	PaymentMethodName  string  `json:"payment_method_name"`
	ReconciliationDate string  `json:"reconciliation_date"`
	ExpectedAmount     float64 `json:"expected_amount"`
	CountedAmount      float64 `json:"counted_amount"`
	DifferenceAmount   float64 `json:"difference_amount"`
	Status             string  `json:"status"`
	CreatedByUserName  string  `json:"created_by_user_name"`
}

type ReceiptRecordReportItem struct {
	SaleID        string  `json:"sale_id"`
	SaleNumber    string  `json:"sale_number"`
	BranchName    string  `json:"branch_name"`
	CustomerName  string  `json:"customer_name"`
	CashierName   string  `json:"cashier_name"`
	TotalAmount   float64 `json:"total_amount"`
	PaidAmount    float64 `json:"paid_amount"`
	PaymentStatus string  `json:"payment_status"`
	SaleStatus    string  `json:"sale_status"`
	SoldAt        string  `json:"sold_at"`
	ViewCount     int64   `json:"view_count"`
	LastViewedAt  *string `json:"last_viewed_at"`
	ReceiptStatus string  `json:"receipt_status"`
}
