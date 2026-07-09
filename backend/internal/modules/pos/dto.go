package pos

import (
	"encoding/json"
	"time"

	"pastries-pos/internal/modules/charges"
)

type CheckoutRequest struct {
	BranchID            string                   `json:"branch_id" binding:"required,uuid"`
	CustomerID          *string                  `json:"customer_id" binding:"omitempty,uuid"`
	CheckoutReference   string                   `json:"checkout_reference"`
	SalesChannelID      *string                  `json:"sales_channel_id" binding:"omitempty,uuid"`
	ExternalOrderNumber string                   `json:"external_order_number"`
	Items               []CheckoutItemRequest    `json:"items" binding:"required"`
	Charges             []charges.ChargeInput    `json:"charges"`
	SaleDiscountType    *string                  `json:"sale_discount_type"`
	SaleDiscountValue   float64                  `json:"sale_discount_value"`
	Payments            []CheckoutPaymentRequest `json:"payments"`
	Notes               string                   `json:"notes"`
}

type CheckoutItemRequest struct {
	ProductID        string  `json:"product_id" binding:"required,uuid"`
	ProductVariantID *string `json:"product_variant_id" binding:"omitempty,uuid"`
	Quantity         float64 `json:"quantity" binding:"required"`
	DiscountType     *string `json:"discount_type"`
	DiscountValue    float64 `json:"discount_value"`
}

type CheckoutPaymentRequest struct {
	PaymentMethodID       string  `json:"payment_method_id" binding:"required,uuid"`
	Amount                float64 `json:"amount" binding:"required"`
	ReferenceNumber       string  `json:"reference_number"`
	ProviderTransactionID string  `json:"provider_transaction_id"`
	Notes                 string  `json:"notes"`
}

type RefundRequest struct {
	RefundAmount     float64 `json:"refund_amount" binding:"required"`
	Reason           string  `json:"reason" binding:"required"`
	ApprovedByUserID *string `json:"approved_by_user_id" binding:"omitempty,uuid"`
}

type VoidRequest struct {
	Reason string `json:"reason" binding:"required"`
}

type HoldSaleRequest struct {
	BranchID          string                `json:"branch_id" binding:"required,uuid"`
	CustomerID        *string               `json:"customer_id" binding:"omitempty,uuid"`
	Items             []HoldSaleItemRequest `json:"items" binding:"required"`
	Charges           []charges.ChargeInput `json:"charges"`
	SaleDiscountType  *string               `json:"sale_discount_type"`
	SaleDiscountValue float64               `json:"sale_discount_value"`
	Notes             string                `json:"notes"`
	ExpiresAt         *time.Time            `json:"expires_at"`
}

type HoldSaleItemRequest struct {
	ProductID        string  `json:"product_id" binding:"required,uuid"`
	ProductVariantID *string `json:"product_variant_id" binding:"omitempty,uuid"`
	Quantity         float64 `json:"quantity" binding:"required"`
	DiscountType     *string `json:"discount_type"`
	DiscountValue    float64 `json:"discount_value"`
}

type HeldSalesListQuery struct {
	Search        string
	BranchID      string
	CashierUserID string
	Status        string
	Page          int
	Limit         int
}

type SalesListQuery struct {
	Search              string
	BranchID            string
	SaleStatus          string
	PaymentStatus       string
	CashierUserID       string
	CustomerID          string
	SalesChannelID      string
	ExternalOrderNumber string
	DateFrom            string
	DateTo              string
	Page                int
	Limit               int
	SortBy              string
	SortOrder           string
}

type POSProductQuery struct {
	Search        string
	CategoryID    string
	ProductType   string
	ItemStructure string
	Page          int
	Limit         int
}

type POSPaymentMethodResponse struct {
	ID                        string  `json:"id"`
	BusinessID                string  `json:"business_id"`
	MethodName                string  `json:"method_name"`
	MethodType                string  `json:"method_type"`
	IsDefault                 bool    `json:"is_default"`
	Status                    string  `json:"status"`
	ShowInPOS                 bool    `json:"show_in_pos"`
	ShowInBakeryOrders        bool    `json:"show_in_bakery_orders"`
	ShowInPurchasing          bool    `json:"show_in_purchasing"`
	ShowInExpenses            bool    `json:"show_in_expenses"`
	ShowInDashboardCollection bool    `json:"show_in_dashboard_collection"`
	AllowSplitPayment         bool    `json:"allow_split_payment"`
	RequiresReference         bool    `json:"requires_reference"`
	DefaultPaymentAccountID   string  `json:"default_payment_account_id"`
	DefaultPaymentAccountName string  `json:"default_payment_account_name"`
	BranchID                  *string `json:"branch_id"`
	BranchName                string  `json:"branch_name"`
	CreatedAt                 string  `json:"created_at"`
	UpdatedAt                 string  `json:"updated_at"`
}

type POSReferenceDataResponse struct {
	ProductCategories []POSProductCategoryOption `json:"product_categories"`
	Units             []POSUnitOption            `json:"units"`
	TaxRates          []POSTaxRateOption         `json:"tax_rates"`
	SalesChannels     []POSSalesChannelOption    `json:"sales_channels"`
	ReceiptLayouts    []POSReceiptLayoutOption   `json:"receipt_layouts"`
}

type POSProductCategoryOption struct {
	ID               string    `json:"id"`
	BusinessID       string    `json:"business_id"`
	BranchID         string    `json:"branch_id"`
	ParentCategoryID *string   `json:"parent_category_id"`
	CategoryName     string    `json:"category_name"`
	CategoryCode     string    `json:"category_code"`
	Description      string    `json:"description"`
	ImageFileID      string    `json:"image_file_id"`
	SortOrder        int       `json:"sort_order"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type POSUnitOption struct {
	ID               string    `json:"id"`
	BusinessID       *string   `json:"business_id"`
	UnitCategoryID   string    `json:"unit_category_id"`
	UnitCategoryName string    `json:"unit_category_name"`
	UnitName         string    `json:"unit_name"`
	Symbol           string    `json:"symbol"`
	BaseUnitID       *string   `json:"base_unit_id"`
	ConversionFactor float64   `json:"conversion_factor"`
	DecimalPrecision int       `json:"decimal_precision"`
	IsSystemDefault  bool      `json:"is_system_default"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type POSTaxRateOption struct {
	ID             string    `json:"id"`
	BusinessID     string    `json:"business_id"`
	TaxName        string    `json:"tax_name"`
	TaxType        string    `json:"tax_type"`
	RatePercentage float64   `json:"rate_percentage"`
	IsInclusive    bool      `json:"is_inclusive"`
	Country        string    `json:"country"`
	Region         string    `json:"region"`
	IsDefault      bool      `json:"is_default"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type POSSalesChannelOption struct {
	ID                          string    `json:"id"`
	BusinessID                  string    `json:"business_id"`
	ChannelName                 string    `json:"channel_name"`
	ChannelType                 string    `json:"channel_type"`
	RequiresExternalOrderNumber bool      `json:"requires_external_order_number"`
	DefaultPaymentMethodID      *string   `json:"default_payment_method_id"`
	DefaultPaymentMethodName    string    `json:"default_payment_method_name"`
	CommissionRate              *float64  `json:"commission_rate"`
	IsDefault                   bool      `json:"is_default"`
	Status                      string    `json:"status"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
}

type POSReceiptLayoutOption struct {
	ID           string          `json:"id"`
	BusinessID   string          `json:"business_id"`
	BranchID     *string         `json:"branch_id"`
	LayoutName   string          `json:"layout_name"`
	ReceiptType  string          `json:"receipt_type"`
	PrinterType  string          `json:"printer_type"`
	CounterID    string          `json:"counter_id"`
	IsDefault    bool            `json:"is_default"`
	Status       string          `json:"status"`
	LayoutConfig json.RawMessage `json:"layout_config"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type PaginatedResponse[T any] struct {
	Items      []T                `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type POSProductResponse struct {
	ID             string               `json:"id"`
	ProductName    string               `json:"product_name"`
	ProductCode    string               `json:"product_code"`
	SKU            string               `json:"sku"`
	Barcode        string               `json:"barcode"`
	Category       LookupInfo           `json:"category"`
	Unit           UnitInfo             `json:"unit"`
	TaxRate        *TaxRateInfo         `json:"tax_rate"`
	ProductType    string               `json:"product_type"`
	ItemStructure  string               `json:"item_structure"`
	SalePrice      float64              `json:"sale_price"`
	ImageFileID    string               `json:"image_file_id"`
	IsSellable     bool                 `json:"is_sellable"`
	IsPOSVisible   bool                 `json:"is_pos_visible"`
	Variants       []POSVariantResponse `json:"variants"`
	IsStockTracked bool                 `json:"is_stock_tracked"`
	Status         string               `json:"status"`
}

type POSVariantResponse struct {
	ID                     string  `json:"id"`
	VariantName            string  `json:"variant_name"`
	SKU                    string  `json:"sku"`
	Barcode                string  `json:"barcode"`
	SalePrice              float64 `json:"sale_price"`
	ImageFileID            string  `json:"image_file_id"`
	CurrentStockQuantity   float64 `json:"current_stock_quantity"`
	AvailableStockQuantity float64 `json:"available_stock_quantity"`
	Status                 string  `json:"status"`
}

type POSLookupResponse struct {
	Product   POSProductResponse  `json:"product"`
	Variant   *POSVariantResponse `json:"variant"`
	MatchedBy string              `json:"matched_by"`
}

type LookupInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"code,omitempty"`
}

type UnitInfo struct {
	ID       string `json:"id"`
	UnitName string `json:"unit_name"`
	Symbol   string `json:"symbol"`
}

type TaxRateInfo struct {
	ID             string  `json:"id"`
	TaxName        string  `json:"tax_name"`
	TaxType        string  `json:"tax_type"`
	RatePercentage float64 `json:"rate_percentage"`
	IsInclusive    bool    `json:"is_inclusive"`
}

type SaleResponse struct {
	ID                       string                   `json:"id"`
	BusinessID               string                   `json:"business_id"`
	BranchID                 string                   `json:"branch_id"`
	BranchName               string                   `json:"branch_name"`
	CashierUserID            string                   `json:"cashier_user_id"`
	CashierName              string                   `json:"cashier_name"`
	CustomerID               *string                  `json:"customer_id"`
	CustomerName             string                   `json:"customer_name"`
	CustomerPhone            string                   `json:"customer_phone"`
	SalesChannelID           *string                  `json:"sales_channel_id"`
	SalesChannelNameSnapshot string                   `json:"sales_channel_name_snapshot"`
	ExternalOrderNumber      string                   `json:"external_order_number"`
	CheckoutReference        string                   `json:"checkout_reference"`
	SaleNumber               string                   `json:"sale_number"`
	SubtotalAmount           float64                  `json:"subtotal_amount"`
	DiscountType             *string                  `json:"discount_type"`
	DiscountValue            float64                  `json:"discount_value"`
	DiscountAmount           float64                  `json:"discount_amount"`
	TaxableAmount            float64                  `json:"taxable_amount"`
	TaxAmount                float64                  `json:"tax_amount"`
	ChargeAmount             float64                  `json:"charge_amount"`
	ChargeTaxAmount          float64                  `json:"charge_tax_amount"`
	TotalAmount              float64                  `json:"total_amount"`
	PaidAmount               float64                  `json:"paid_amount"`
	ChangeAmount             float64                  `json:"change_amount"`
	PaymentStatus            string                   `json:"payment_status"`
	SaleStatus               string                   `json:"sale_status"`
	AccountingJournalEntryID *string                  `json:"accounting_journal_entry_id"`
	Notes                    string                   `json:"notes"`
	SoldAt                   time.Time                `json:"sold_at"`
	Items                    []SaleItemResponse       `json:"items,omitempty"`
	Payments                 []SalePaymentResponse    `json:"payments,omitempty"`
	Refunds                  []SaleRefundResponse     `json:"refunds,omitempty"`
	Charges                  []charges.ChargeResponse `json:"charges,omitempty"`
	Void                     *SaleVoidResponse        `json:"void,omitempty"`
	Receipt                  *ReceiptReadyResponse    `json:"receipt,omitempty"`
	CreatedAt                time.Time                `json:"created_at"`
	UpdatedAt                time.Time                `json:"updated_at"`
}

type SaleSummaryResponse struct {
	ID                       string    `json:"id"`
	SaleNumber               string    `json:"sale_number"`
	BranchID                 string    `json:"branch_id"`
	BranchName               string    `json:"branch_name"`
	CashierUserID            string    `json:"cashier_user_id"`
	CashierName              string    `json:"cashier_name"`
	CustomerID               *string   `json:"customer_id"`
	CustomerName             string    `json:"customer_name"`
	SalesChannelID           *string   `json:"sales_channel_id"`
	SalesChannelNameSnapshot string    `json:"sales_channel_name_snapshot"`
	ExternalOrderNumber      string    `json:"external_order_number"`
	ChargeAmount             float64   `json:"charge_amount"`
	ChargeTaxAmount          float64   `json:"charge_tax_amount"`
	TotalAmount              float64   `json:"total_amount"`
	PaidAmount               float64   `json:"paid_amount"`
	PaymentStatus            string    `json:"payment_status"`
	SaleStatus               string    `json:"sale_status"`
	SoldAt                   time.Time `json:"sold_at"`
}

type SaleItemResponse struct {
	ID                        string  `json:"id"`
	ProductID                 string  `json:"product_id"`
	ProductVariantID          *string `json:"product_variant_id"`
	ProductNameSnapshot       string  `json:"product_name_snapshot"`
	VariantNameSnapshot       string  `json:"variant_name_snapshot"`
	SKUSnapshot               string  `json:"sku_snapshot"`
	Quantity                  float64 `json:"quantity"`
	UnitPrice                 float64 `json:"unit_price"`
	DiscountAmount            float64 `json:"discount_amount"`
	TaxRateID                 *string `json:"tax_rate_id"`
	TaxRateNameSnapshot       string  `json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64 `json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64 `json:"tax_amount"`
	LineSubtotal              float64 `json:"line_subtotal"`
	LineTotal                 float64 `json:"line_total"`
}

type SalePaymentResponse struct {
	ID                        string    `json:"id"`
	PaymentMethodID           string    `json:"payment_method_id"`
	PaymentMethodNameSnapshot string    `json:"payment_method_name_snapshot"`
	PaymentMethodTypeSnapshot string    `json:"payment_method_type_snapshot"`
	Amount                    float64   `json:"amount"`
	ReferenceNumber           string    `json:"reference_number"`
	ProviderTransactionID     string    `json:"provider_transaction_id"`
	PaymentStatus             string    `json:"payment_status"`
	JournalEntryID            *string   `json:"journal_entry_id"`
	PaidByUserID              string    `json:"paid_by_user_id"`
	Notes                     string    `json:"notes"`
	PaidAt                    time.Time `json:"paid_at"`
}

type SaleRefundResponse struct {
	ID               string    `json:"id"`
	RefundNumber     string    `json:"refund_number"`
	RefundAmount     float64   `json:"refund_amount"`
	Reason           string    `json:"reason"`
	ApprovedByUserID *string   `json:"approved_by_user_id"`
	CreatedByUserID  string    `json:"created_by_user_id"`
	CreatedAt        time.Time `json:"created_at"`
}

type SaleVoidResponse struct {
	ID               string    `json:"id"`
	Reason           string    `json:"reason"`
	ApprovedByUserID *string   `json:"approved_by_user_id"`
	CreatedByUserID  string    `json:"created_by_user_id"`
	CreatedAt        time.Time `json:"created_at"`
}

type ReceiptReadyResponse struct {
	BusinessName    string                   `json:"business_name"`
	BranchName      string                   `json:"branch_name"`
	VATNumber       string                   `json:"vat_number"`
	ReceiptFooter   string                   `json:"receipt_footer"`
	SaleNumber      string                   `json:"sale_number"`
	SoldAt          time.Time                `json:"sold_at"`
	CashierName     string                   `json:"cashier_name"`
	CustomerID      *string                  `json:"customer_id"`
	CustomerName    string                   `json:"customer_name"`
	CustomerPhone   string                   `json:"customer_phone"`
	Items           []SaleItemResponse       `json:"items"`
	Subtotal        float64                  `json:"subtotal"`
	Discount        float64                  `json:"discount"`
	TaxAmount       float64                  `json:"tax_amount"`
	ChargeAmount    float64                  `json:"charge_amount"`
	ChargeTaxAmount float64                  `json:"charge_tax_amount"`
	Total           float64                  `json:"total"`
	Charges         []charges.ChargeResponse `json:"charges"`
	Payments        []SalePaymentResponse    `json:"payments"`
	PaidAmount      float64                  `json:"paid_amount"`
	ChangeAmount    float64                  `json:"change_amount"`
	QRPlaceholder   string                   `json:"qr_placeholder"`
}

type HeldSaleResponse struct {
	ID                       string                   `json:"id"`
	BusinessID               string                   `json:"business_id"`
	BranchID                 string                   `json:"branch_id"`
	BranchName               string                   `json:"branch_name"`
	CashierUserID            string                   `json:"cashier_user_id"`
	CashierName              string                   `json:"cashier_name"`
	CustomerID               *string                  `json:"customer_id"`
	HoldNumber               string                   `json:"hold_number"`
	ItemCount                int                      `json:"item_count"`
	EstimatedSubtotal        float64                  `json:"estimated_subtotal"`
	EstimatedDiscountAmount  float64                  `json:"estimated_discount_amount"`
	EstimatedTaxAmount       float64                  `json:"estimated_tax_amount"`
	EstimatedChargeAmount    float64                  `json:"estimated_charge_amount"`
	EstimatedChargeTaxAmount float64                  `json:"estimated_charge_tax_amount"`
	EstimatedTotal           float64                  `json:"estimated_total"`
	Status                   string                   `json:"status"`
	Notes                    string                   `json:"notes"`
	HeldAt                   time.Time                `json:"held_at"`
	ResumedAt                *time.Time               `json:"resumed_at"`
	CancelledAt              *time.Time               `json:"cancelled_at"`
	ExpiresAt                *time.Time               `json:"expires_at"`
	Items                    []HeldSaleItemResponse   `json:"items,omitempty" gorm:"-"`
	Charges                  []charges.ChargeResponse `json:"charges,omitempty" gorm:"-"`
	CreatedAt                time.Time                `json:"created_at"`
	UpdatedAt                time.Time                `json:"updated_at"`
}

type HeldSaleItemResponse struct {
	ID                        string  `json:"id"`
	ProductID                 string  `json:"product_id"`
	ProductVariantID          *string `json:"product_variant_id"`
	ProductNameSnapshot       string  `json:"product_name_snapshot"`
	VariantNameSnapshot       string  `json:"variant_name_snapshot"`
	SKUSnapshot               string  `json:"sku_snapshot"`
	Quantity                  float64 `json:"quantity"`
	UnitPrice                 float64 `json:"unit_price"`
	DiscountType              *string `json:"discount_type"`
	DiscountValue             float64 `json:"discount_value"`
	DiscountAmount            float64 `json:"discount_amount"`
	TaxRateID                 *string `json:"tax_rate_id"`
	TaxRateNameSnapshot       string  `json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64 `json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64 `json:"tax_amount"`
	LineSubtotal              float64 `json:"line_subtotal"`
	LineTotal                 float64 `json:"line_total"`
	SortOrder                 int     `json:"sort_order"`
}

type ResumeHeldSaleResponse struct {
	HeldSale HeldSaleResponse `json:"held_sale"`
	Cart     HoldSaleRequest  `json:"cart"`
}
