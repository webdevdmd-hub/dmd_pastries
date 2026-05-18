package pos

import "time"

type CheckoutRequest struct {
	BranchID          string                   `json:"branch_id" binding:"required,uuid"`
	CustomerID        *string                  `json:"customer_id" binding:"omitempty,uuid"`
	Items             []CheckoutItemRequest    `json:"items" binding:"required"`
	SaleDiscountType  *string                  `json:"sale_discount_type"`
	SaleDiscountValue float64                  `json:"sale_discount_value"`
	Payments          []CheckoutPaymentRequest `json:"payments"`
	Notes             string                   `json:"notes"`
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
	Search        string
	BranchID      string
	SaleStatus    string
	PaymentStatus string
	CashierUserID string
	CustomerID    string
	DateFrom      string
	DateTo        string
	Page          int
	Limit         int
	SortBy        string
	SortOrder     string
}

type POSProductQuery struct {
	Search      string
	CategoryID  string
	ProductType string
	Page        int
	Limit       int
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
	SalePrice      float64              `json:"sale_price"`
	ImageFileID    string               `json:"image_file_id"`
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
	ID             string                `json:"id"`
	BusinessID     string                `json:"business_id"`
	BranchID       string                `json:"branch_id"`
	BranchName     string                `json:"branch_name"`
	CashierUserID  string                `json:"cashier_user_id"`
	CashierName    string                `json:"cashier_name"`
	CustomerID     *string               `json:"customer_id"`
	CustomerName   string                `json:"customer_name"`
	CustomerPhone  string                `json:"customer_phone"`
	SaleNumber     string                `json:"sale_number"`
	SubtotalAmount float64               `json:"subtotal_amount"`
	DiscountType   *string               `json:"discount_type"`
	DiscountValue  float64               `json:"discount_value"`
	DiscountAmount float64               `json:"discount_amount"`
	TaxableAmount  float64               `json:"taxable_amount"`
	TaxAmount      float64               `json:"tax_amount"`
	TotalAmount    float64               `json:"total_amount"`
	PaidAmount     float64               `json:"paid_amount"`
	ChangeAmount   float64               `json:"change_amount"`
	PaymentStatus  string                `json:"payment_status"`
	SaleStatus     string                `json:"sale_status"`
	Notes          string                `json:"notes"`
	SoldAt         time.Time             `json:"sold_at"`
	Items          []SaleItemResponse    `json:"items,omitempty"`
	Payments       []SalePaymentResponse `json:"payments,omitempty"`
	Refunds        []SaleRefundResponse  `json:"refunds,omitempty"`
	Void           *SaleVoidResponse     `json:"void,omitempty"`
	Receipt        *ReceiptReadyResponse `json:"receipt,omitempty"`
	CreatedAt      time.Time             `json:"created_at"`
	UpdatedAt      time.Time             `json:"updated_at"`
}

type SaleSummaryResponse struct {
	ID            string    `json:"id"`
	SaleNumber    string    `json:"sale_number"`
	BranchID      string    `json:"branch_id"`
	BranchName    string    `json:"branch_name"`
	CashierUserID string    `json:"cashier_user_id"`
	CashierName   string    `json:"cashier_name"`
	CustomerID    *string   `json:"customer_id"`
	CustomerName  string    `json:"customer_name"`
	TotalAmount   float64   `json:"total_amount"`
	PaidAmount    float64   `json:"paid_amount"`
	PaymentStatus string    `json:"payment_status"`
	SaleStatus    string    `json:"sale_status"`
	SoldAt        time.Time `json:"sold_at"`
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
	BusinessName  string                `json:"business_name"`
	BranchName    string                `json:"branch_name"`
	VATNumber     string                `json:"vat_number"`
	ReceiptFooter string                `json:"receipt_footer"`
	SaleNumber    string                `json:"sale_number"`
	SoldAt        time.Time             `json:"sold_at"`
	CashierName   string                `json:"cashier_name"`
	CustomerID    *string               `json:"customer_id"`
	CustomerName  string                `json:"customer_name"`
	CustomerPhone string                `json:"customer_phone"`
	Items         []SaleItemResponse    `json:"items"`
	Subtotal      float64               `json:"subtotal"`
	Discount      float64               `json:"discount"`
	TaxAmount     float64               `json:"tax_amount"`
	Total         float64               `json:"total"`
	Payments      []SalePaymentResponse `json:"payments"`
	PaidAmount    float64               `json:"paid_amount"`
	ChangeAmount  float64               `json:"change_amount"`
	QRPlaceholder string                `json:"qr_placeholder"`
}

type HeldSaleResponse struct {
	ID                      string                 `json:"id"`
	BusinessID              string                 `json:"business_id"`
	BranchID                string                 `json:"branch_id"`
	BranchName              string                 `json:"branch_name"`
	CashierUserID           string                 `json:"cashier_user_id"`
	CashierName             string                 `json:"cashier_name"`
	CustomerID              *string                `json:"customer_id"`
	HoldNumber              string                 `json:"hold_number"`
	ItemCount               int                    `json:"item_count"`
	EstimatedSubtotal       float64                `json:"estimated_subtotal"`
	EstimatedDiscountAmount float64                `json:"estimated_discount_amount"`
	EstimatedTaxAmount      float64                `json:"estimated_tax_amount"`
	EstimatedTotal          float64                `json:"estimated_total"`
	Status                  string                 `json:"status"`
	Notes                   string                 `json:"notes"`
	HeldAt                  time.Time              `json:"held_at"`
	ResumedAt               *time.Time             `json:"resumed_at"`
	CancelledAt             *time.Time             `json:"cancelled_at"`
	ExpiresAt               *time.Time             `json:"expires_at"`
	Items                   []HeldSaleItemResponse `json:"items,omitempty" gorm:"-"`
	CreatedAt               time.Time              `json:"created_at"`
	UpdatedAt               time.Time              `json:"updated_at"`
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
