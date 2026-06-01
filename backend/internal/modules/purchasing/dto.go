package purchasing

import "time"

type ListQuery struct {
	Search        string
	BranchID      string
	SupplierID    string
	Status        string
	PaymentStatus string
	DateFrom      string
	DateTo        string
	Page          int
	Limit         int
	SortBy        string
	SortOrder     string
}

type PaymentListQuery struct {
	Search          string
	BranchID        string
	SupplierID      string
	InvoiceID       string
	PaymentMethodID string
	PaymentStatus   string
	PaidByUserID    string
	DateFrom        string
	DateTo          string
	Page            int
	Limit           int
	SortBy          string
	SortOrder       string
}

type ConvertPurchaseOrderToInvoiceRequest struct {
	InvoiceDate string `json:"invoice_date"`
	DueDate     string `json:"due_date"`
	Notes       string `json:"notes"`
}

type ConvertPurchaseInvoiceToReceiptRequest struct {
	ReceivedDate string `json:"received_date"`
	Notes        string `json:"notes"`
}

type CreatePurchaseOrderRequest struct {
	BranchID             string                   `json:"branch_id" binding:"required"`
	SupplierID           string                   `json:"supplier_id" binding:"required"`
	OrderDate            string                   `json:"order_date" binding:"required"`
	ExpectedDeliveryDate string                   `json:"expected_delivery_date"`
	Items                []PurchaseOrderItemInput `json:"items" binding:"required"`
	Notes                string                   `json:"notes"`
}

type UpdatePurchaseOrderRequest struct {
	BranchID             string                   `json:"branch_id"`
	SupplierID           string                   `json:"supplier_id"`
	OrderDate            string                   `json:"order_date"`
	ExpectedDeliveryDate string                   `json:"expected_delivery_date"`
	Items                []PurchaseOrderItemInput `json:"items"`
	Notes                string                   `json:"notes"`
}

type PurchaseOrderItemInput struct {
	ItemType        string  `json:"item_type" binding:"required"`
	ProductID       string  `json:"product_id"`
	IngredientID    string  `json:"ingredient_id"`
	PackagingItemID string  `json:"packaging_item_id"`
	QuantityOrdered float64 `json:"quantity_ordered" binding:"required"`
	UnitID          string  `json:"unit_id" binding:"required"`
	UnitCost        float64 `json:"unit_cost"`
	DiscountAmount  float64 `json:"discount_amount"`
	TaxRateID       string  `json:"tax_rate_id"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type CreatePurchaseInvoiceRequest struct {
	BranchID        string                     `json:"branch_id" binding:"required"`
	SupplierID      string                     `json:"supplier_id" binding:"required"`
	PurchaseOrderID string                     `json:"purchase_order_id"`
	InvoiceNumber   string                     `json:"invoice_number" binding:"required"`
	InvoiceDate     string                     `json:"invoice_date" binding:"required"`
	DueDate         string                     `json:"due_date"`
	Items           []PurchaseInvoiceItemInput `json:"items" binding:"required"`
	Notes           string                     `json:"notes"`
}

type UpdatePurchaseInvoiceRequest struct {
	BranchID        string                     `json:"branch_id"`
	SupplierID      string                     `json:"supplier_id"`
	PurchaseOrderID string                     `json:"purchase_order_id"`
	InvoiceNumber   string                     `json:"invoice_number"`
	InvoiceDate     string                     `json:"invoice_date"`
	DueDate         string                     `json:"due_date"`
	Items           []PurchaseInvoiceItemInput `json:"items"`
	Notes           string                     `json:"notes"`
}

type PurchaseInvoiceItemInput struct {
	ItemType        string  `json:"item_type" binding:"required"`
	ProductID       string  `json:"product_id"`
	IngredientID    string  `json:"ingredient_id"`
	PackagingItemID string  `json:"packaging_item_id"`
	Quantity        float64 `json:"quantity" binding:"required"`
	UnitID          string  `json:"unit_id" binding:"required"`
	UnitCost        float64 `json:"unit_cost"`
	DiscountAmount  float64 `json:"discount_amount"`
	TaxRateID       string  `json:"tax_rate_id"`
	ExpiryDate      string  `json:"expiry_date"`
	BatchNumber     string  `json:"batch_number"`
}

type ReceivePurchaseRequest struct {
	BranchID          string                     `json:"branch_id" binding:"required"`
	SupplierID        string                     `json:"supplier_id" binding:"required"`
	PurchaseOrderID   string                     `json:"purchase_order_id"`
	PurchaseInvoiceID string                     `json:"purchase_invoice_id"`
	ReceivedDate      string                     `json:"received_date" binding:"required"`
	Items             []PurchaseReceiptItemInput `json:"items" binding:"required"`
	Notes             string                     `json:"notes"`
}

type AddPurchaseInvoicePaymentRequest struct {
	PaymentMethodID string  `json:"payment_method_id" binding:"required"`
	Amount          float64 `json:"amount" binding:"required"`
	ReferenceNumber string  `json:"reference_number"`
	PaidAt          string  `json:"paid_at"`
	Notes           string  `json:"notes"`
}

type PurchaseReceiptItemInput struct {
	ItemType         string  `json:"item_type" binding:"required"`
	ProductID        string  `json:"product_id"`
	IngredientID     string  `json:"ingredient_id"`
	PackagingItemID  string  `json:"packaging_item_id"`
	QuantityReceived float64 `json:"quantity_received" binding:"required"`
	UnitID           string  `json:"unit_id" binding:"required"`
	ExpiryDate       string  `json:"expiry_date"`
	BatchNumber      string  `json:"batch_number"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type PaginatedResponse[T any] struct {
	Items      []T                `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type PurchaseOrderResponse struct {
	ID                   string                      `json:"id"`
	BusinessID           string                      `json:"business_id"`
	BranchID             string                      `json:"branch_id"`
	BranchName           string                      `json:"branch_name"`
	SupplierID           string                      `json:"supplier_id"`
	SupplierName         string                      `json:"supplier_name"`
	PurchaseOrderNumber  string                      `json:"purchase_order_number"`
	OrderDate            time.Time                   `json:"order_date"`
	ExpectedDeliveryDate *time.Time                  `json:"expected_delivery_date"`
	Status               string                      `json:"status"`
	SubtotalAmount       float64                     `json:"subtotal_amount"`
	TaxAmount            float64                     `json:"tax_amount"`
	DiscountAmount       float64                     `json:"discount_amount"`
	TotalAmount          float64                     `json:"total_amount"`
	Notes                string                      `json:"notes"`
	Items                []PurchaseOrderItemResponse `json:"items,omitempty"`
	CreatedAt            time.Time                   `json:"created_at"`
	UpdatedAt            time.Time                   `json:"updated_at"`
}

type PurchaseOrderItemResponse struct {
	ID               string  `json:"id"`
	ItemType         string  `json:"item_type"`
	ProductID        *string `json:"product_id"`
	IngredientID     *string `json:"ingredient_id"`
	PackagingItemID  *string `json:"packaging_item_id"`
	ItemNameSnapshot string  `json:"item_name_snapshot"`
	QuantityOrdered  float64 `json:"quantity_ordered"`
	QuantityReceived float64 `json:"quantity_received"`
	UnitID           string  `json:"unit_id"`
	UnitSymbol       string  `json:"unit_symbol"`
	UnitCost         float64 `json:"unit_cost"`
	DiscountAmount   float64 `json:"discount_amount"`
	TaxRateID        *string `json:"tax_rate_id"`
	TaxAmount        float64 `json:"tax_amount"`
	LineTotal        float64 `json:"line_total"`
}

type PurchaseInvoiceResponse struct {
	ID              string                           `json:"id"`
	BusinessID      string                           `json:"business_id"`
	BranchID        string                           `json:"branch_id"`
	BranchName      string                           `json:"branch_name"`
	SupplierID      string                           `json:"supplier_id"`
	SupplierName    string                           `json:"supplier_name"`
	PurchaseOrderID *string                          `json:"purchase_order_id"`
	InvoiceNumber   string                           `json:"invoice_number"`
	InvoiceDate     time.Time                        `json:"invoice_date"`
	DueDate         *time.Time                       `json:"due_date"`
	Status          string                           `json:"status"`
	PaymentStatus   string                           `json:"payment_status"`
	SubtotalAmount  float64                          `json:"subtotal_amount"`
	TaxAmount       float64                          `json:"tax_amount"`
	DiscountAmount  float64                          `json:"discount_amount"`
	TotalAmount     float64                          `json:"total_amount"`
	PaidAmount      float64                          `json:"paid_amount"`
	BalanceAmount   float64                          `json:"balance_amount"`
	Notes           string                           `json:"notes"`
	Items           []PurchaseInvoiceItemResponse    `json:"items,omitempty"`
	Payments        []PurchaseInvoicePaymentResponse `json:"payments,omitempty"`
	CreatedAt       time.Time                        `json:"created_at"`
	UpdatedAt       time.Time                        `json:"updated_at"`
}

type PurchaseInvoiceItemResponse struct {
	ID               string     `json:"id"`
	ItemType         string     `json:"item_type"`
	ProductID        *string    `json:"product_id"`
	IngredientID     *string    `json:"ingredient_id"`
	PackagingItemID  *string    `json:"packaging_item_id"`
	ItemNameSnapshot string     `json:"item_name_snapshot"`
	Quantity         float64    `json:"quantity"`
	UnitID           string     `json:"unit_id"`
	UnitSymbol       string     `json:"unit_symbol"`
	UnitCost         float64    `json:"unit_cost"`
	DiscountAmount   float64    `json:"discount_amount"`
	TaxRateID        *string    `json:"tax_rate_id"`
	TaxAmount        float64    `json:"tax_amount"`
	LineTotal        float64    `json:"line_total"`
	ExpiryDate       *time.Time `json:"expiry_date"`
	BatchNumber      string     `json:"batch_number"`
}

type PurchaseInvoicePaymentResponse struct {
	PaymentID         string    `json:"payment_id"`
	PurchaseInvoiceID string    `json:"purchase_invoice_id"`
	InvoiceNumber     string    `json:"invoice_number"`
	SupplierID        string    `json:"supplier_id"`
	SupplierName      string    `json:"supplier_name"`
	BranchID          string    `json:"branch_id"`
	BranchName        string    `json:"branch_name"`
	PaymentMethodID   string    `json:"payment_method_id"`
	PaymentMethodName string    `json:"payment_method_name"`
	PaymentMethodType string    `json:"payment_method_type"`
	Amount            float64   `json:"amount"`
	PaymentStatus     string    `json:"payment_status"`
	ReferenceNumber   string    `json:"reference_number"`
	PaidByUserID      string    `json:"paid_by_user_id"`
	PaidByUserName    string    `json:"paid_by_user_name"`
	PaidAt            time.Time `json:"paid_at"`
	Notes             string    `json:"notes"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type PurchasingDocumentChainResponse struct {
	PurchaseOrder    *PurchaseDocumentChainItem  `json:"purchase_order"`
	PurchaseInvoices []PurchaseDocumentChainItem `json:"purchase_invoices"`
	PurchaseReceipts []PurchaseDocumentChainItem `json:"purchase_receipts"`
	SupplierPayments []PurchaseDocumentChainItem `json:"supplier_payments"`
}

type PurchaseDocumentChainItem struct {
	ID                string    `json:"id"`
	DocumentNumber    string    `json:"document_number"`
	DocumentType      string    `json:"document_type"`
	Status            string    `json:"status"`
	Date              time.Time `json:"date"`
	TotalAmount       float64   `json:"total_amount"`
	PurchaseOrderID   *string   `json:"purchase_order_id,omitempty"`
	PurchaseInvoiceID *string   `json:"purchase_invoice_id,omitempty"`
	PurchaseReceiptID *string   `json:"purchase_receipt_id,omitempty"`
	PreviousID        *string   `json:"previous_id,omitempty"`
	NextID            *string   `json:"next_id,omitempty"`
}

type PurchaseReceiptResponse struct {
	ID                string                        `json:"id"`
	BusinessID        string                        `json:"business_id"`
	BranchID          string                        `json:"branch_id"`
	BranchName        string                        `json:"branch_name"`
	SupplierID        string                        `json:"supplier_id"`
	SupplierName      string                        `json:"supplier_name"`
	PurchaseOrderID   *string                       `json:"purchase_order_id"`
	PurchaseInvoiceID *string                       `json:"purchase_invoice_id"`
	ReceiptNumber     string                        `json:"receipt_number"`
	ReceivedDate      time.Time                     `json:"received_date"`
	Status            string                        `json:"status"`
	ReceivedByUserID  string                        `json:"received_by_user_id"`
	Notes             string                        `json:"notes"`
	Items             []PurchaseReceiptItemResponse `json:"items,omitempty"`
	CreatedAt         time.Time                     `json:"created_at"`
	UpdatedAt         time.Time                     `json:"updated_at"`
}

type PurchaseReceiptItemResponse struct {
	ID               string     `json:"id"`
	ItemType         string     `json:"item_type"`
	ProductID        *string    `json:"product_id"`
	IngredientID     *string    `json:"ingredient_id"`
	PackagingItemID  *string    `json:"packaging_item_id"`
	InventoryItemID  string     `json:"inventory_item_id"`
	QuantityReceived float64    `json:"quantity_received"`
	UnitID           string     `json:"unit_id"`
	UnitSymbol       string     `json:"unit_symbol"`
	ExpiryDate       *time.Time `json:"expiry_date"`
	BatchNumber      string     `json:"batch_number"`
	StockMovementID  *string    `json:"stock_movement_id"`
}

type PurchasingSummaryResponse struct {
	TotalPurchaseOrders int64   `json:"total_purchase_orders"`
	OpenPurchaseOrders  int64   `json:"open_purchase_orders"`
	TotalInvoices       int64   `json:"total_invoices"`
	UnpaidInvoiceAmount float64 `json:"unpaid_invoice_amount"`
	PurchasesThisMonth  float64 `json:"purchases_this_month"`
	ReceivedThisMonth   float64 `json:"received_this_month"`
}

type SupplierHistoryResponse struct {
	SupplierID          string                    `json:"supplier_id"`
	PurchaseOrders      []PurchaseOrderResponse   `json:"purchase_orders"`
	Invoices            []PurchaseInvoiceResponse `json:"invoices"`
	Receipts            []PurchaseReceiptResponse `json:"receipts"`
	TotalPurchaseAmount float64                   `json:"total_purchase_amount"`
	LastPurchaseDate    *time.Time                `json:"last_purchase_date"`
}
