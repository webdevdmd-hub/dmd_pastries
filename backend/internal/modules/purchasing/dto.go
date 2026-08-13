package purchasing

import (
	"time"

	"pastries-pos/internal/modules/charges"
)

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

type PurchaseReturnListQuery struct {
	Search            string
	BranchID          string
	SupplierID        string
	PurchaseInvoiceID string
	PurchaseReceiptID string
	Status            string
	DateFrom          string
	DateTo            string
	Page              int
	Limit             int
	SortBy            string
	SortOrder         string
}

type ConvertPurchaseOrderToInvoiceRequest struct {
	InvoiceDate        string `json:"invoice_date"`
	DueDate            string `json:"due_date"`
	SupplierBillNumber string `json:"supplier_bill_number"`
	Notes              string `json:"notes"`
}

type ConvertPurchaseInvoiceToReceiptRequest struct {
	ReceivedDate string `json:"received_date"`
	Notes        string `json:"notes"`
}

type CreatePurchaseOrderRequest struct {
	BranchID             string                   `json:"branch_id" binding:"required"`
	SupplierID           string                   `json:"supplier_id" binding:"required"`
	OrderDate            string                   `json:"order_date" binding:"required"`
	ExpectedDeliveryDate *string                  `json:"expected_delivery_date"`
	Items                []PurchaseOrderItemInput `json:"items" binding:"required"`
	Charges              []charges.ChargeInput    `json:"charges"`
	Notes                string                   `json:"notes"`
}

type CreatePurchaseOrderRevisionRequest struct {
	BranchID             string                   `json:"branch_id"`
	SupplierID           string                   `json:"supplier_id"`
	OrderDate            string                   `json:"order_date"`
	ExpectedDeliveryDate *string                  `json:"expected_delivery_date"`
	Items                []PurchaseOrderItemInput `json:"items"`
	Charges              []charges.ChargeInput    `json:"charges"`
	PaymentExcessAction  string                   `json:"payment_excess_action"`
	Reason               string                   `json:"reason"`
	Notes                string                   `json:"notes"`
}
type UpdatePurchaseOrderRequest struct {
	BranchID             string                   `json:"branch_id"`
	SupplierID           string                   `json:"supplier_id"`
	OrderDate            string                   `json:"order_date"`
	ExpectedDeliveryDate *string                  `json:"expected_delivery_date"`
	Items                []PurchaseOrderItemInput `json:"items"`
	Charges              []charges.ChargeInput    `json:"charges"`
	Notes                string                   `json:"notes"`
}

type PurchaseOrderItemInput struct {
	ID              string  `json:"id"`
	LineType        string  `json:"line_type"`
	ItemType        string  `json:"item_type" binding:"required"`
	ProductID       string  `json:"product_id"`
	IngredientID    string  `json:"ingredient_id"`
	PackagingItemID string  `json:"packaging_item_id"`
	AccountID       string  `json:"account_id"`
	Description     string  `json:"description"`
	QuantityOrdered float64 `json:"quantity_ordered" binding:"required"`
	UnitID          string  `json:"unit_id"`
	UnitCost        float64 `json:"unit_cost"`
	DiscountAmount  float64 `json:"discount_amount"`
	TaxRateID       string  `json:"tax_rate_id"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type CancelPurchaseInvoiceRequest struct {
	Reason string `json:"reason"`
}

type CreatePurchaseInvoiceRequest struct {
	BranchID           string                     `json:"branch_id" binding:"required"`
	SupplierID         string                     `json:"supplier_id" binding:"required"`
	PurchaseOrderID    string                     `json:"purchase_order_id"`
	InvoiceNumber      string                     `json:"invoice_number" binding:"required"`
	SupplierBillNumber string                     `json:"supplier_bill_number"`
	InvoiceDate        string                     `json:"invoice_date" binding:"required"`
	DueDate            string                     `json:"due_date"`
	Items              []PurchaseInvoiceItemInput `json:"items" binding:"required"`
	BillDiscountAmount float64                    `json:"bill_discount_amount"`
	Charges            []charges.ChargeInput      `json:"charges"`
	Notes              string                     `json:"notes"`
	// TaxMode is the bill's VAT mode (W3): inclusive | exclusive | no_tax.
	// Empty falls back to the business default.
	TaxMode string `json:"tax_mode"`
}

type UpdatePurchaseInvoiceRequest struct {
	BranchID           string                     `json:"branch_id"`
	SupplierID         string                     `json:"supplier_id"`
	PurchaseOrderID    string                     `json:"purchase_order_id"`
	InvoiceNumber      string                     `json:"invoice_number"`
	SupplierBillNumber string                     `json:"supplier_bill_number"`
	InvoiceDate        string                     `json:"invoice_date"`
	DueDate            string                     `json:"due_date"`
	Items              []PurchaseInvoiceItemInput `json:"items"`
	BillDiscountAmount *float64                   `json:"bill_discount_amount"`
	Charges            []charges.ChargeInput      `json:"charges"`
	Notes              string                     `json:"notes"`
	TaxMode            string                     `json:"tax_mode"`
}

type PurchaseInvoiceItemInput struct {
	LineType         string  `json:"line_type"`
	ItemType         string  `json:"item_type"`
	ProductID        string  `json:"product_id"`
	IngredientID     string  `json:"ingredient_id"`
	PackagingItemID  string  `json:"packaging_item_id"`
	AccountID        string  `json:"account_id"`
	Description      string  `json:"description"`
	ItemNameSnapshot string  `json:"item_name_snapshot"`
	Quantity         float64 `json:"quantity" binding:"required"`
	UnitID           string  `json:"unit_id"`
	UnitCost         float64 `json:"unit_cost"`
	DiscountAmount   float64 `json:"discount_amount"`
	TaxRateID        string  `json:"tax_rate_id"`
	ExpiryDate       string  `json:"expiry_date"`
	BatchNumber      string  `json:"batch_number"`
}

type ReceivePurchaseRequest struct {
	BranchID          string                     `json:"branch_id" binding:"required"`
	SupplierID        string                     `json:"supplier_id" binding:"required"`
	PurchaseOrderID   string                     `json:"purchase_order_id"`
	PurchaseInvoiceID string                     `json:"purchase_invoice_id"`
	ReceivedDate      string                     `json:"received_date" binding:"required"`
	Items             []PurchaseReceiptItemInput `json:"items" binding:"required"`
	Charges           []charges.ChargeInput      `json:"charges"`
	Notes             string                     `json:"notes"`
}

type ReceivePurchaseOrderRequest struct {
	BranchID          string                     `json:"branch_id"`
	SupplierID        string                     `json:"supplier_id"`
	PurchaseInvoiceID string                     `json:"purchase_invoice_id"`
	ReceivedDate      string                     `json:"received_date"`
	Items             []PurchaseReceiptItemInput `json:"items"`
	Charges           []charges.ChargeInput      `json:"charges"`
	Notes             string                     `json:"notes"`
}

type AddPurchaseInvoicePaymentRequest struct {
	PaymentMethodID      string  `json:"payment_method_id" binding:"required"`
	PaidThroughAccountID string  `json:"paid_through_account_id"`
	Amount               float64 `json:"amount" binding:"required"`
	ReferenceNumber      string  `json:"reference_number"`
	PaidAt               string  `json:"paid_at"`
	Notes                string  `json:"notes"`
}

type CreateSupplierPaymentRequest struct {
	SupplierID           string                           `json:"supplier_id" binding:"required"`
	BranchID             string                           `json:"branch_id"`
	PaymentMethodID      string                           `json:"payment_method_id" binding:"required"`
	PaidThroughAccountID string                           `json:"paid_through_account_id"`
	Amount               float64                          `json:"amount" binding:"required"`
	ReferenceNumber      string                           `json:"reference_number"`
	PaymentDate          string                           `json:"payment_date"`
	Notes                string                           `json:"notes"`
	Allocations          []SupplierPaymentAllocationInput `json:"allocations"`
}

type UpdateSupplierPaymentRequest = CreateSupplierPaymentRequest

type SupplierPaymentAllocationInput struct {
	PurchaseInvoiceID string  `json:"purchase_invoice_id" binding:"required"`
	Amount            float64 `json:"amount" binding:"required"`
}

type PurchaseReceiptItemInput struct {
	ItemType         string  `json:"item_type" binding:"required"`
	ProductID        string  `json:"product_id"`
	IngredientID     string  `json:"ingredient_id"`
	PackagingItemID  string  `json:"packaging_item_id"`
	QuantityReceived float64 `json:"quantity_received" binding:"required"`
	UnitID           string  `json:"unit_id" binding:"required"`
	UnitCost         float64 `json:"unit_cost"`
	ExpiryDate       string  `json:"expiry_date"`
	BatchNumber      string  `json:"batch_number"`
}

type CreatePurchaseReturnRequest struct {
	PurchaseReceiptID       string                    `json:"purchase_receipt_id" binding:"required"`
	ReturnDate              string                    `json:"return_date" binding:"required"`
	Reason                  string                    `json:"reason"`
	SupplierReferenceNumber string                    `json:"supplier_reference_number"`
	Items                   []PurchaseReturnItemInput `json:"items" binding:"required"`
	Charges                 []charges.ChargeInput     `json:"charges"`
}

type UpdatePurchaseReturnRequest struct {
	ReturnDate              string                    `json:"return_date"`
	Reason                  string                    `json:"reason"`
	SupplierReferenceNumber string                    `json:"supplier_reference_number"`
	Items                   []PurchaseReturnItemInput `json:"items"`
	Charges                 []charges.ChargeInput     `json:"charges"`
}

type ReversePurchaseReturnRequest struct {
	Reason string `json:"reason" binding:"required"`
}

type PurchaseReturnItemInput struct {
	PurchaseReceiptItemID string  `json:"purchase_receipt_item_id" binding:"required"`
	Quantity              float64 `json:"quantity" binding:"required"`
	StockLocationID       string  `json:"stock_location_id"`
	Reason                string  `json:"reason"`
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
	ChargeAmount         float64                     `json:"charge_amount"`
	ChargeTaxAmount      float64                     `json:"charge_tax_amount"`
	TotalAmount          float64                     `json:"total_amount"`
	Notes                string                      `json:"notes"`
	Items                []PurchaseOrderItemResponse `json:"items,omitempty"`
	Charges              []charges.ChargeResponse    `json:"charges,omitempty"`
	CreatedAt            time.Time                   `json:"created_at"`
	UpdatedAt            time.Time                   `json:"updated_at"`
}

type PurchaseOrderRevisionImpactResponse struct {
	OriginalTotal          float64 `json:"original_total"`
	RevisedTotal           float64 `json:"revised_total"`
	DifferenceAmount       float64 `json:"difference_amount"`
	ExtraQuantityToReceive float64 `json:"extra_quantity_to_receive"`
	OverReceivedQuantity   float64 `json:"over_received_quantity"`
	HasFinalizedHistory    bool    `json:"has_finalized_history"`
	PostedReceiptCount     int64   `json:"posted_receipt_count"`
	PostedInvoiceCount     int64   `json:"posted_invoice_count"`
	SupplierPaymentCount   int64   `json:"supplier_payment_count"`
	StockMovementCount     int64   `json:"stock_movement_count"`
	VendorCreditCount      int64   `json:"vendor_credit_count"`
	InventoryImpact        string  `json:"inventory_impact"`
	BillImpact             string  `json:"bill_impact"`
	PaymentImpact          string  `json:"payment_impact"`
	AccountingImpact       string  `json:"accounting_impact"`
	SupplierBalanceImpact  string  `json:"supplier_balance_impact"`
}

type PurchaseOrderRevisionResponse struct {
	ID                  string                              `json:"id"`
	PurchaseOrderID     string                              `json:"purchase_order_id"`
	PurchaseOrderNumber string                              `json:"purchase_order_number"`
	RevisionNumber      int                                 `json:"revision_number"`
	Status              string                              `json:"status"`
	PaymentExcessAction string                              `json:"payment_excess_action"`
	Reason              string                              `json:"reason"`
	Impact              PurchaseOrderRevisionImpactResponse `json:"impact"`
	Order               PurchaseOrderResponse               `json:"order"`
	CreatedAt           time.Time                           `json:"created_at"`
}
type PurchaseOrderItemResponse struct {
	ID               string  `json:"id"`
	LineType         string  `json:"line_type"`
	ItemType         string  `json:"item_type"`
	ProductID        *string `json:"product_id"`
	IngredientID     *string `json:"ingredient_id"`
	PackagingItemID  *string `json:"packaging_item_id"`
	AccountID        *string `json:"account_id"`
	AccountName      string  `json:"account_name_snapshot"`
	AccountCode      string  `json:"account_code_snapshot"`
	Description      string  `json:"description"`
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
	ID                     string                           `json:"id"`
	BusinessID             string                           `json:"business_id"`
	BranchID               string                           `json:"branch_id"`
	BranchName             string                           `json:"branch_name"`
	SupplierID             string                           `json:"supplier_id"`
	SupplierName           string                           `json:"supplier_name"`
	PurchaseOrderID        *string                          `json:"purchase_order_id"`
	PurchaseOrderNumber    string                           `json:"purchase_order_number"`
	InvoiceNumber          string                           `json:"invoice_number"`
	SupplierBillNumber     string                           `json:"supplier_bill_number"`
	InvoiceDate            time.Time                        `json:"invoice_date"`
	DueDate                *time.Time                       `json:"due_date"`
	Status                 string                           `json:"status"`
	PaymentStatus          string                           `json:"payment_status"`
	SubtotalAmount         float64                          `json:"subtotal_amount"`
	TaxAmount              float64                          `json:"tax_amount"`
	DiscountAmount         float64                          `json:"discount_amount"`
	BillDiscountAmount     float64                          `json:"bill_discount_amount"`
	ChargeAmount           float64                          `json:"charge_amount"`
	ChargeTaxAmount        float64                          `json:"charge_tax_amount"`
	TotalAmount            float64                          `json:"total_amount"`
	PaidAmount             float64                          `json:"paid_amount"`
	BalanceAmount          float64                          `json:"balance_amount"`
	ReturnedAmount         float64                          `json:"returned_amount"`
	CreditedAmount         float64                          `json:"credited_amount"`
	ReturnStatus           string                           `json:"return_status"`
	ReceiveStatus          string                           `json:"receive_status"`
	CanReceiveStock        bool                             `json:"can_receive_stock"`
	JournalEntryID         *string                          `json:"journal_entry_id"`
	CancelledByUserID      *string                          `json:"cancelled_by_user_id"`
	CancelledAt            *time.Time                       `json:"cancelled_at"`
	CancelReason           string                           `json:"cancel_reason"`
	ReversalJournalEntryID *string                          `json:"reversal_journal_entry_id"`
	CancelledReceiptID     *string                          `json:"cancelled_receipt_id"`
	Notes                  string                           `json:"notes"`
	Items                  []PurchaseInvoiceItemResponse    `json:"items,omitempty"`
	Charges                []charges.ChargeResponse         `json:"charges,omitempty"`
	Payments               []PurchaseInvoicePaymentResponse `json:"payments,omitempty"`
	CreatedAt              time.Time                        `json:"created_at"`
	UpdatedAt              time.Time                        `json:"updated_at"`
}

type PurchaseInvoiceItemResponse struct {
	ID                string     `json:"id"`
	LineType          string     `json:"line_type"`
	ItemType          string     `json:"item_type"`
	ProductID         *string    `json:"product_id"`
	IngredientID      *string    `json:"ingredient_id"`
	PackagingItemID   *string    `json:"packaging_item_id"`
	AccountID         *string    `json:"account_id"`
	AccountName       string     `json:"account_name_snapshot"`
	AccountCode       string     `json:"account_code_snapshot"`
	Description       string     `json:"description"`
	ItemNameSnapshot  string     `json:"item_name_snapshot"`
	Quantity          float64    `json:"quantity"`
	QuantityReceived  float64    `json:"quantity_received"`
	QuantityRemaining float64    `json:"quantity_remaining"`
	CanReceive        bool       `json:"can_receive"`
	UnitID            string     `json:"unit_id"`
	UnitSymbol        string     `json:"unit_symbol"`
	UnitCost          float64    `json:"unit_cost"`
	DiscountAmount    float64    `json:"discount_amount"`
	TaxRateID         *string    `json:"tax_rate_id"`
	TaxAmount         float64    `json:"tax_amount"`
	LineTotal         float64    `json:"line_total"`
	ExpiryDate        *time.Time `json:"expiry_date"`
	BatchNumber       string     `json:"batch_number"`
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
	JournalEntryID    *string   `json:"journal_entry_id"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type SupplierPaymentResponse struct {
	ID                     string                              `json:"id"`
	BusinessID             string                              `json:"business_id"`
	BranchID               string                              `json:"branch_id"`
	BranchName             string                              `json:"branch_name"`
	SupplierID             string                              `json:"supplier_id"`
	SupplierName           string                              `json:"supplier_name"`
	PaymentMethodID        string                              `json:"payment_method_id"`
	PaymentMethodName      string                              `json:"payment_method_name"`
	PaymentMethodType      string                              `json:"payment_method_type"`
	PaidThroughAccountID   string                              `json:"paid_through_account_id"`
	PaidThroughAccountName string                              `json:"paid_through_account_name"`
	Amount                 float64                             `json:"amount"`
	AllocatedAmount        float64                             `json:"allocated_amount"`
	UnappliedAmount        float64                             `json:"unapplied_amount"`
	ReferenceNumber        string                              `json:"reference_number"`
	PaymentDate            time.Time                           `json:"payment_date"`
	Status                 string                              `json:"status"`
	Notes                  string                              `json:"notes"`
	JournalEntryID         *string                             `json:"journal_entry_id"`
	PaidByUserID           string                              `json:"paid_by_user_id"`
	PaidByUserName         string                              `json:"paid_by_user_name"`
	Allocations            []SupplierPaymentAllocationResponse `json:"allocations,omitempty" gorm:"-"`
	CreatedAt              time.Time                           `json:"created_at"`
	UpdatedAt              time.Time                           `json:"updated_at"`
}

type SupplierPaymentAllocationResponse struct {
	ID                string    `json:"id"`
	SupplierPaymentID string    `json:"supplier_payment_id"`
	PurchaseInvoiceID string    `json:"purchase_invoice_id"`
	InvoiceNumber     string    `json:"invoice_number"`
	Amount            float64   `json:"amount"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type PurchasingPaymentMethodResponse struct {
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

type PurchasingDocumentChainResponse struct {
	PurchaseOrder    *PurchaseDocumentChainItem  `json:"purchase_order"`
	PurchaseInvoices []PurchaseDocumentChainItem `json:"purchase_invoices"`
	PurchaseReceipts []PurchaseDocumentChainItem `json:"purchase_receipts"`
	PurchaseReturns  []PurchaseDocumentChainItem `json:"purchase_returns"`
	SupplierPayments []PurchaseDocumentChainItem `json:"supplier_payments"`
}

type PurchaseDocumentChainItem struct {
	ID                       string    `json:"id"`
	DocumentNumber           string    `json:"document_number"`
	DocumentType             string    `json:"document_type"`
	Status                   string    `json:"status"`
	Date                     time.Time `json:"date"`
	TotalAmount              float64   `json:"total_amount"`
	PurchaseOrderID          *string   `json:"purchase_order_id,omitempty"`
	PurchaseInvoiceID        *string   `json:"purchase_invoice_id,omitempty"`
	PurchaseReceiptID        *string   `json:"purchase_receipt_id,omitempty"`
	PurchaseReturnID         *string   `json:"purchase_return_id,omitempty"`
	PreviousID               *string   `json:"previous_id,omitempty"`
	NextID                   *string   `json:"next_id,omitempty"`
	AccountingStatus         string    `json:"accounting_status,omitempty"`
	AccountingStatusLabel    string    `json:"accounting_status_label,omitempty"`
	AccountingStatusDetail   string    `json:"accounting_status_detail,omitempty"`
	LinkedBillStatus         *string   `json:"linked_bill_status,omitempty"`
	LinkedBillJournalEntryID *string   `json:"linked_bill_journal_entry_id,omitempty"`
}

type PurchaseReceiptResponse struct {
	ID                       string                        `json:"id"`
	BusinessID               string                        `json:"business_id"`
	BranchID                 string                        `json:"branch_id"`
	BranchName               string                        `json:"branch_name"`
	SupplierID               string                        `json:"supplier_id"`
	SupplierName             string                        `json:"supplier_name"`
	PurchaseOrderID          *string                       `json:"purchase_order_id"`
	PurchaseOrderNumber      string                        `json:"purchase_order_number"`
	PurchaseInvoiceID        *string                       `json:"purchase_invoice_id"`
	PurchaseInvoiceNumber    string                        `json:"purchase_invoice_number"`
	ReceiptNumber            string                        `json:"receipt_number"`
	ReceivedDate             time.Time                     `json:"received_date"`
	Status                   string                        `json:"status"`
	ChargeAmount             float64                       `json:"charge_amount"`
	ChargeTaxAmount          float64                       `json:"charge_tax_amount"`
	JournalEntryID           *string                       `json:"journal_entry_id"`
	AccountingStatus         string                        `json:"accounting_status"`
	AccountingStatusLabel    string                        `json:"accounting_status_label"`
	AccountingStatusDetail   string                        `json:"accounting_status_detail"`
	LinkedBillStatus         *string                       `json:"linked_bill_status"`
	LinkedBillJournalEntryID *string                       `json:"linked_bill_journal_entry_id"`
	ReceivedByUserID         string                        `json:"received_by_user_id"`
	Notes                    string                        `json:"notes"`
	Items                    []PurchaseReceiptItemResponse `json:"items,omitempty"`
	Charges                  []charges.ChargeResponse      `json:"charges,omitempty"`
	CreatedAt                time.Time                     `json:"created_at"`
	UpdatedAt                time.Time                     `json:"updated_at"`
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
	UnitCost         float64    `json:"unit_cost"`
	ExpiryDate       *time.Time `json:"expiry_date"`
	BatchNumber      string     `json:"batch_number"`
	StockMovementID  *string    `json:"stock_movement_id"`
}

type PurchaseReturnResponse struct {
	ID                         string                       `json:"id"`
	BusinessID                 string                       `json:"business_id"`
	BranchID                   string                       `json:"branch_id"`
	BranchName                 string                       `json:"branch_name"`
	SupplierID                 string                       `json:"supplier_id"`
	SupplierName               string                       `json:"supplier_name"`
	PurchaseOrderID            *string                      `json:"purchase_order_id"`
	PurchaseInvoiceID          *string                      `json:"purchase_invoice_id"`
	PurchaseInvoiceNumber      string                       `json:"purchase_invoice_number"`
	PurchaseReceiptID          string                       `json:"purchase_receipt_id"`
	PurchaseReceiptNumber      string                       `json:"purchase_receipt_number"`
	ReturnNumber               string                       `json:"return_number"`
	ReturnDate                 time.Time                    `json:"return_date"`
	SupplierReferenceNumber    string                       `json:"supplier_reference_number"`
	Reason                     string                       `json:"reason"`
	Status                     string                       `json:"status"`
	SubtotalAmount             float64                      `json:"subtotal_amount"`
	TaxAmount                  float64                      `json:"tax_amount"`
	DiscountAmount             float64                      `json:"discount_amount"`
	ChargeAmount               float64                      `json:"charge_amount"`
	ChargeTaxAmount            float64                      `json:"charge_tax_amount"`
	ReturnTotal                float64                      `json:"return_total"`
	AppliedCreditAmount        float64                      `json:"applied_credit_amount"`
	OpenCreditAmount           float64                      `json:"open_credit_amount"`
	JournalEntryID             *string                      `json:"journal_entry_id"`
	JournalEntryNumber         *string                      `json:"journal_entry_number"`
	ReversalJournalEntryID     *string                      `json:"reversal_journal_entry_id"`
	ReversalJournalEntryNumber *string                      `json:"reversal_journal_entry_number"`
	OriginalReturnID           *string                      `json:"original_return_id"`
	OriginalReturnNumber       *string                      `json:"original_return_number"`
	ReversalReturnID           *string                      `json:"reversal_return_id"`
	ReversalReturnNumber       *string                      `json:"reversal_return_number"`
	ReversalReason             string                       `json:"reversal_reason"`
	ReversedByUserID           *string                      `json:"reversed_by_user_id"`
	ReversedByUserName         string                       `json:"reversed_by_user_name"`
	ReversedAt                 *time.Time                   `json:"reversed_at"`
	CreatedByUserID            string                       `json:"created_by_user_id"`
	PostedByUserID             *string                      `json:"posted_by_user_id"`
	PostedAt                   *time.Time                   `json:"posted_at"`
	CancelledByUserID          *string                      `json:"cancelled_by_user_id"`
	CancelledAt                *time.Time                   `json:"cancelled_at"`
	Items                      []PurchaseReturnItemResponse `json:"items,omitempty"`
	Charges                    []charges.ChargeResponse     `json:"charges,omitempty"`
	CreatedAt                  time.Time                    `json:"created_at"`
	UpdatedAt                  time.Time                    `json:"updated_at"`
}

type PurchaseReturnItemResponse struct {
	ID                    string  `json:"id"`
	PurchaseReceiptItemID string  `json:"purchase_receipt_item_id"`
	ItemType              string  `json:"item_type"`
	ProductID             *string `json:"product_id"`
	IngredientID          *string `json:"ingredient_id"`
	PackagingItemID       *string `json:"packaging_item_id"`
	InventoryItemID       string  `json:"inventory_item_id"`
	ItemNameSnapshot      string  `json:"item_name_snapshot"`
	Quantity              float64 `json:"quantity"`
	UnitID                string  `json:"unit_id"`
	UnitSymbol            string  `json:"unit_symbol"`
	UnitCost              float64 `json:"unit_cost"`
	DiscountAmount        float64 `json:"discount_amount"`
	TaxRateID             *string `json:"tax_rate_id"`
	TaxAmount             float64 `json:"tax_amount"`
	LineSubtotal          float64 `json:"line_subtotal"`
	LineTotal             float64 `json:"line_total"`
	StockLocationID       *string `json:"stock_location_id"`
	StockLocationName     string  `json:"stock_location_name"`
	StockMovementID       *string `json:"stock_movement_id"`
	Reason                string  `json:"reason"`
}

type PurchaseReturnableItemResponse struct {
	PurchaseReceiptItemID string     `json:"purchase_receipt_item_id"`
	ItemType              string     `json:"item_type"`
	ProductID             *string    `json:"product_id"`
	IngredientID          *string    `json:"ingredient_id"`
	PackagingItemID       *string    `json:"packaging_item_id"`
	InventoryItemID       string     `json:"inventory_item_id"`
	ItemNameSnapshot      string     `json:"item_name_snapshot"`
	QuantityReceived      float64    `json:"quantity_received"`
	QuantityReturned      float64    `json:"quantity_returned"`
	ReturnableQuantity    float64    `json:"returnable_quantity"`
	UnitID                string     `json:"unit_id"`
	UnitSymbol            string     `json:"unit_symbol"`
	UnitCost              float64    `json:"unit_cost"`
	DiscountAmount        float64    `json:"discount_amount"`
	TaxRateID             *string    `json:"tax_rate_id"`
	TaxAmount             float64    `json:"tax_amount"`
	LineSubtotal          float64    `json:"line_subtotal"`
	LineTotal             float64    `json:"line_total"`
	ExpiryDate            *time.Time `json:"expiry_date"`
	BatchNumber           string     `json:"batch_number"`
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
	Returns             []PurchaseReturnResponse  `json:"returns"`
	TotalPurchaseAmount float64                   `json:"total_purchase_amount"`
	OpenVendorCredit    float64                   `json:"open_vendor_credit"`
	LastPurchaseDate    *time.Time                `json:"last_purchase_date"`
}
