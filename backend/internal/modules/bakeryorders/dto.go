package bakeryorders

import (
	"encoding/json"
	"time"

	"pastries-pos/internal/modules/charges"
)

type OrderListQuery struct {
	Search              string
	BranchID            string
	CustomerID          string
	SalesChannelID      string
	ExternalOrderNumber string
	OrderType           string
	OrderStatus         string
	PaymentStatus       string
	DateFrom            string
	DateTo              string
	Page                int
	Limit               int
	SortBy              string
	SortOrder           string
}

type OrderItemRequest struct {
	ProductID          string          `json:"product_id"`
	ProductVariantID   string          `json:"product_variant_id"`
	ItemName           string          `json:"item_name"`
	Quantity           float64         `json:"quantity"`
	UnitID             string          `json:"unit_id"`
	Weight             json.RawMessage `json:"weight"`
	Flavor             string          `json:"flavor"`
	DesignNotes        string          `json:"design_notes"`
	MessageText        string          `json:"message_text"`
	CustomizationsJSON json.RawMessage `json:"customizations_json"`
	UnitPrice          float64         `json:"unit_price"`
	DiscountAmount     float64         `json:"discount_amount"`
}

type CreateOrderRequest struct {
	BranchID            string                `json:"branch_id"`
	CustomerID          string                `json:"customer_id"`
	SalesChannelID      string                `json:"sales_channel_id"`
	ExternalOrderNumber string                `json:"external_order_number"`
	CustomerName        string                `json:"customer_name"`
	CustomerPhone       string                `json:"customer_phone"`
	OrderType           string                `json:"order_type"`
	EventDate           string                `json:"event_date"`
	PickupTime          string                `json:"pickup_time"`
	DeliveryTime        string                `json:"delivery_time"`
	DeliveryAddr        string                `json:"delivery_address"`
	Items               []OrderItemRequest    `json:"items"`
	Charges             []charges.ChargeInput `json:"charges"`
	Notes               string                `json:"notes"`
}

type UpdateOrderRequest struct {
	CustomerID          *string               `json:"customer_id"`
	SalesChannelID      *string               `json:"sales_channel_id"`
	ExternalOrderNumber *string               `json:"external_order_number"`
	CustomerName        *string               `json:"customer_name"`
	CustomerPhone       *string               `json:"customer_phone"`
	OrderType           *string               `json:"order_type"`
	EventDate           *string               `json:"event_date"`
	PickupTime          *string               `json:"pickup_time"`
	DeliveryTime        *string               `json:"delivery_time"`
	DeliveryAddr        *string               `json:"delivery_address"`
	Charges             []charges.ChargeInput `json:"charges"`
	Notes               *string               `json:"notes"`
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

type AddPaymentRequest struct {
	PaymentMethodID string  `json:"payment_method_id"`
	Amount          float64 `json:"amount"`
	ReferenceNumber string  `json:"reference_number"`
	PaymentType     string  `json:"payment_type"`
}

type AssignProductionRequest struct {
	ProductionBatchID string `json:"production_batch_id"`
}

type CreateProductionFromItemRequest struct {
	RecipeID        string  `json:"recipe_id"`
	PlannedQuantity float64 `json:"planned_quantity"`
	ProductionDate  string  `json:"production_date"`
	Notes           string  `json:"notes"`
}

type ConvertItemToProductRequest struct {
	CategoryID             string   `json:"category_id"`
	ProductName            string   `json:"product_name"`
	ProductCode            string   `json:"product_code"`
	SKU                    string   `json:"sku"`
	Barcode                string   `json:"barcode"`
	SalePrice              float64  `json:"sale_price"`
	CostPrice              *float64 `json:"cost_price"`
	UnitID                 string   `json:"unit_id"`
	ProductType            string   `json:"product_type"`
	IsStockTracked         bool     `json:"is_stock_tracked"`
	IsExpiryTracked        bool     `json:"is_expiry_tracked"`
	IsCustomOrderAvailable bool     `json:"is_custom_order_available"`
	ShowInPOS              *bool    `json:"show_in_pos"`
	Description            string   `json:"description"`
	Status                 string   `json:"status"`
}

type ConvertItemToVariantRequest struct {
	ProductID   string   `json:"product_id"`
	VariantName string   `json:"variant_name"`
	SKU         string   `json:"sku"`
	Barcode     string   `json:"barcode"`
	SalePrice   float64  `json:"sale_price"`
	CostPrice   *float64 `json:"cost_price"`
	UnitID      string   `json:"unit_id"`
	ShowInPOS   *bool    `json:"show_in_pos"`
}

type UpdateProductionStatusRequest struct {
	Status string `json:"status"`
}

type AddPackagingRequest struct {
	PackagingItemID  string  `json:"packaging_item_id"`
	QuantityRequired float64 `json:"quantity_required"`
	UnitID           string  `json:"unit_id"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type PaginatedOrdersResponse struct {
	Items      []BakeryOrderResponse `json:"items"`
	Pagination PaginationResponse    `json:"pagination"`
}

type BakeryOrderResponse struct {
	ID                       string                          `json:"id"`
	BusinessID               string                          `json:"business_id"`
	BranchID                 string                          `json:"branch_id"`
	BranchName               string                          `json:"branch_name"`
	OrderNumber              string                          `json:"order_number"`
	CustomerID               *string                         `json:"customer_id"`
	SalesChannelID           *string                         `json:"sales_channel_id"`
	SalesChannelNameSnapshot string                          `json:"sales_channel_name_snapshot"`
	ExternalOrderNumber      string                          `json:"external_order_number"`
	CustomerNameSnapshot     string                          `json:"customer_name_snapshot"`
	CustomerPhoneSnapshot    string                          `json:"customer_phone_snapshot"`
	OrderType                string                          `json:"order_type"`
	OrderDate                time.Time                       `json:"order_date"`
	EventDate                time.Time                       `json:"event_date"`
	PickupTime               string                          `json:"pickup_time"`
	DeliveryTime             string                          `json:"delivery_time"`
	DeliveryAddress          string                          `json:"delivery_address"`
	SubtotalAmount           float64                         `json:"subtotal_amount"`
	DiscountAmount           float64                         `json:"discount_amount"`
	TaxAmount                float64                         `json:"tax_amount"`
	ChargeAmount             float64                         `json:"charge_amount"`
	ChargeTaxAmount          float64                         `json:"charge_tax_amount"`
	TotalAmount              float64                         `json:"total_amount"`
	PaidAmount               float64                         `json:"paid_amount"`
	BalanceAmount            float64                         `json:"balance_amount"`
	PaymentStatus            string                          `json:"payment_status"`
	OrderStatus              string                          `json:"order_status"`
	AccountingJournalEntryID *string                         `json:"accounting_journal_entry_id"`
	Notes                    string                          `json:"notes"`
	CreatedByUserID          string                          `json:"created_by_user_id"`
	CreatedByUserName        string                          `json:"created_by_user_name"`
	CreatedAt                time.Time                       `json:"created_at"`
	UpdatedAt                time.Time                       `json:"updated_at"`
	Items                    []BakeryOrderItemResponse       `json:"items,omitempty"`
	Payments                 []BakeryOrderPaymentResponse    `json:"payments,omitempty"`
	Charges                  []charges.ChargeResponse        `json:"charges,omitempty"`
	Production               *BakeryOrderProductionResponse  `json:"production,omitempty"`
	Productions              []BakeryOrderProductionResponse `json:"productions,omitempty"`
	Packaging                []BakeryOrderPackagingResponse  `json:"packaging,omitempty"`
}

type BakeryOrderItemResponse struct {
	ID                         string    `json:"id"`
	BakeryOrderID              string    `json:"bakery_order_id"`
	ProductID                  *string   `json:"product_id"`
	ProductVariantID           *string   `json:"product_variant_id"`
	ProductNameSnapshot        string    `json:"product_name_snapshot"`
	ProductVariantNameSnapshot string    `json:"product_variant_name_snapshot"`
	ItemNameSnapshot           string    `json:"item_name_snapshot"`
	ItemSource                 string    `json:"item_source"`
	Quantity                   float64   `json:"quantity"`
	UnitID                     string    `json:"unit_id"`
	UnitSymbol                 string    `json:"unit_symbol"`
	Weight                     string    `json:"weight"`
	Flavor                     string    `json:"flavor"`
	DesignNotes                string    `json:"design_notes"`
	MessageText                string    `json:"message_text"`
	CustomizationsJSON         string    `json:"customizations_json"`
	UnitPrice                  float64   `json:"unit_price"`
	DiscountAmount             float64   `json:"discount_amount"`
	TaxRateID                  *string   `json:"tax_rate_id"`
	TaxRateName                string    `json:"tax_rate_name"`
	TaxAmount                  float64   `json:"tax_amount"`
	LineTotal                  float64   `json:"line_total"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

type BakeryOrderPaymentResponse struct {
	ID                        string    `json:"id"`
	BakeryOrderID             string    `json:"bakery_order_id"`
	PaymentMethodID           string    `json:"payment_method_id"`
	PaymentMethodNameSnapshot string    `json:"payment_method_name_snapshot"`
	Amount                    float64   `json:"amount"`
	ReferenceNumber           string    `json:"reference_number"`
	PaymentType               string    `json:"payment_type"`
	JournalEntryID            *string   `json:"journal_entry_id"`
	PaidByUserID              string    `json:"paid_by_user_id"`
	PaidByUserName            string    `json:"paid_by_user_name"`
	PaidAt                    time.Time `json:"paid_at"`
	CreatedAt                 time.Time `json:"created_at"`
}

type BakeryOrderProductionResponse struct {
	ID                    string    `json:"id"`
	BakeryOrderID         string    `json:"bakery_order_id"`
	BakeryOrderItemID     *string   `json:"bakery_order_item_id"`
	ProductionBatchID     *string   `json:"production_batch_id"`
	ProductionBatchNumber string    `json:"production_batch_number"`
	Status                string    `json:"status"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type BakeryOrderPackagingResponse struct {
	ID                    string    `json:"id"`
	BakeryOrderID         string    `json:"bakery_order_id"`
	PackagingItemID       string    `json:"packaging_item_id"`
	PackagingNameSnapshot string    `json:"packaging_name_snapshot"`
	QuantityRequired      float64   `json:"quantity_required"`
	UnitID                string    `json:"unit_id"`
	UnitSymbol            string    `json:"unit_symbol"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type SummaryResponse struct {
	TotalOrders        int64 `json:"total_orders"`
	PendingOrders      int64 `json:"pending_orders"`
	InProductionOrders int64 `json:"in_production_orders"`
	ReadyOrders        int64 `json:"ready_orders"`
	CompletedOrders    int64 `json:"completed_orders"`
	TodayOrders        int64 `json:"today_orders"`
}

type productRow struct {
	ID           string
	ProductName  string
	UnitID       string
	TaxRateID    *string
	SalePrice    float64
	Status       string
	IsPOSVisible bool
}

type productVariantRow struct {
	ID          string
	ProductID   string
	VariantName string
	SalePrice   float64
	Status      string
}

type customerRow struct {
	ID       string
	FullName string
	Phone    string
	Status   string
}

type taxRow struct {
	ID             string
	TaxName        string
	RatePercentage float64
	IsInclusive    bool
}

type paymentMethodRow struct {
	ID                 string
	MethodName         string
	RequiresReference  bool
	ShowInBakeryOrders bool
}

type salesChannelRow struct {
	ID                          string
	ChannelName                 string
	RequiresExternalOrderNumber bool
	Status                      string
}

type packagingRow struct {
	ID            string
	PackagingName string
	UnitID        string
	Status        string
}

type recipeProductionRow struct {
	ID               string
	ProductID        string
	ProductVariantID *string
	IsActive         bool
	Status           string
}
