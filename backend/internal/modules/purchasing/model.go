package purchasing

import (
	"time"

	"gorm.io/gorm"
)

type PurchaseOrder struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID           string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID             string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierID           string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	PurchaseOrderNumber  string         `gorm:"size:100;not null" json:"purchase_order_number"`
	OrderDate            time.Time      `gorm:"type:date;not null" json:"order_date"`
	ExpectedDeliveryDate *time.Time     `gorm:"type:date" json:"expected_delivery_date"`
	Status               string         `gorm:"size:50;not null;default:draft" json:"status"`
	SubtotalAmount       float64        `gorm:"not null;default:0" json:"subtotal_amount"`
	TaxAmount            float64        `gorm:"not null;default:0" json:"tax_amount"`
	DiscountAmount       float64        `gorm:"not null;default:0" json:"discount_amount"`
	TotalAmount          float64        `gorm:"not null;default:0" json:"total_amount"`
	Notes                string         `json:"notes"`
	CreatedByUserID      string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID      string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseOrder) TableName() string { return "purchase_orders" }

type PurchaseOrderItem struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string         `gorm:"type:uuid;not null;index" json:"business_id"`
	PurchaseOrderID  string         `gorm:"type:uuid;not null;index" json:"purchase_order_id"`
	ItemType         string         `gorm:"size:50;not null" json:"item_type"`
	ProductID        *string        `gorm:"type:uuid;index" json:"product_id"`
	IngredientID     *string        `gorm:"type:uuid;index" json:"ingredient_id"`
	PackagingItemID  *string        `gorm:"type:uuid;index" json:"packaging_item_id"`
	ItemNameSnapshot string         `gorm:"size:255;not null" json:"item_name_snapshot"`
	QuantityOrdered  float64        `gorm:"not null" json:"quantity_ordered"`
	QuantityReceived float64        `gorm:"not null;default:0" json:"quantity_received"`
	UnitID           string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCost         float64        `gorm:"not null;default:0" json:"unit_cost"`
	DiscountAmount   float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID        *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxAmount        float64        `gorm:"not null;default:0" json:"tax_amount"`
	LineTotal        float64        `gorm:"not null;default:0" json:"line_total"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseOrderItem) TableName() string { return "purchase_order_items" }

type PurchaseInvoice struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierID      string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	PurchaseOrderID *string        `gorm:"type:uuid;index" json:"purchase_order_id"`
	InvoiceNumber   string         `gorm:"size:150;not null" json:"invoice_number"`
	InvoiceDate     time.Time      `gorm:"type:date;not null" json:"invoice_date"`
	DueDate         *time.Time     `gorm:"type:date" json:"due_date"`
	Status          string         `gorm:"size:50;not null;default:draft" json:"status"`
	PaymentStatus   string         `gorm:"size:50;not null;default:unpaid" json:"payment_status"`
	SubtotalAmount  float64        `gorm:"not null;default:0" json:"subtotal_amount"`
	TaxAmount       float64        `gorm:"not null;default:0" json:"tax_amount"`
	DiscountAmount  float64        `gorm:"not null;default:0" json:"discount_amount"`
	TotalAmount     float64        `gorm:"not null;default:0" json:"total_amount"`
	PaidAmount      float64        `gorm:"not null;default:0" json:"paid_amount"`
	BalanceAmount   float64        `gorm:"not null;default:0" json:"balance_amount"`
	ReturnedAmount  float64        `gorm:"not null;default:0" json:"returned_amount"`
	CreditedAmount  float64        `gorm:"not null;default:0" json:"credited_amount"`
	ReturnStatus    string         `gorm:"size:50;not null;default:none" json:"return_status"`
	JournalEntryID  *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	Notes           string         `json:"notes"`
	CreatedByUserID string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseInvoice) TableName() string { return "purchase_invoices" }

type PurchaseInvoiceItem struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string         `gorm:"type:uuid;not null;index" json:"business_id"`
	PurchaseInvoiceID string         `gorm:"type:uuid;not null;index" json:"purchase_invoice_id"`
	ItemType          string         `gorm:"size:50;not null" json:"item_type"`
	ProductID         *string        `gorm:"type:uuid;index" json:"product_id"`
	IngredientID      *string        `gorm:"type:uuid;index" json:"ingredient_id"`
	PackagingItemID   *string        `gorm:"type:uuid;index" json:"packaging_item_id"`
	ItemNameSnapshot  string         `gorm:"size:255;not null" json:"item_name_snapshot"`
	Quantity          float64        `gorm:"not null" json:"quantity"`
	UnitID            string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCost          float64        `gorm:"not null;default:0" json:"unit_cost"`
	DiscountAmount    float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID         *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxAmount         float64        `gorm:"not null;default:0" json:"tax_amount"`
	LineTotal         float64        `gorm:"not null;default:0" json:"line_total"`
	ExpiryDate        *time.Time     `gorm:"type:date" json:"expiry_date"`
	BatchNumber       string         `gorm:"size:100" json:"batch_number"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseInvoiceItem) TableName() string { return "purchase_invoice_items" }

type PurchaseInvoicePayment struct {
	ID                        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                  string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	PurchaseInvoiceID         string         `gorm:"type:uuid;not null;index" json:"purchase_invoice_id"`
	SupplierID                string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	PaymentMethodID           string         `gorm:"type:uuid;not null;index" json:"payment_method_id"`
	PaymentMethodNameSnapshot string         `gorm:"size:150;not null" json:"payment_method_name_snapshot"`
	PaymentMethodTypeSnapshot string         `gorm:"size:50;not null" json:"payment_method_type_snapshot"`
	Amount                    float64        `gorm:"not null" json:"amount"`
	PaymentStatus             string         `gorm:"size:50;not null;default:completed" json:"payment_status"`
	ReferenceNumber           string         `gorm:"size:255" json:"reference_number"`
	PaidByUserID              string         `gorm:"type:uuid;not null;index" json:"paid_by_user_id"`
	PaidAt                    time.Time      `gorm:"not null" json:"paid_at"`
	Notes                     string         `json:"notes"`
	JournalEntryID            *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseInvoicePayment) TableName() string { return "purchase_invoice_payments" }

type PurchaseReceipt struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID          string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierID        string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	PurchaseOrderID   *string        `gorm:"type:uuid;index" json:"purchase_order_id"`
	PurchaseInvoiceID *string        `gorm:"type:uuid;index" json:"purchase_invoice_id"`
	ReceiptNumber     string         `gorm:"size:100;not null" json:"receipt_number"`
	ReceivedDate      time.Time      `gorm:"type:date;not null" json:"received_date"`
	Status            string         `gorm:"size:50;not null;default:posted" json:"status"`
	JournalEntryID    *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	ReceivedByUserID  string         `gorm:"type:uuid;not null;index" json:"received_by_user_id"`
	Notes             string         `json:"notes"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseReceipt) TableName() string { return "purchase_receipts" }

type PurchaseReceiptItem struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string         `gorm:"type:uuid;not null;index" json:"business_id"`
	PurchaseReceiptID string         `gorm:"type:uuid;not null;index" json:"purchase_receipt_id"`
	ItemType          string         `gorm:"size:50;not null" json:"item_type"`
	ProductID         *string        `gorm:"type:uuid;index" json:"product_id"`
	IngredientID      *string        `gorm:"type:uuid;index" json:"ingredient_id"`
	PackagingItemID   *string        `gorm:"type:uuid;index" json:"packaging_item_id"`
	InventoryItemID   string         `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	QuantityReceived  float64        `gorm:"not null" json:"quantity_received"`
	UnitID            string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCost          float64        `gorm:"not null;default:0" json:"unit_cost"`
	ExpiryDate        *time.Time     `gorm:"type:date" json:"expiry_date"`
	BatchNumber       string         `gorm:"size:100" json:"batch_number"`
	StockMovementID   *string        `gorm:"type:uuid;index" json:"stock_movement_id"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseReceiptItem) TableName() string { return "purchase_receipt_items" }

type PurchaseReturn struct {
	ID                      string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID              string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierID              string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	PurchaseOrderID         *string        `gorm:"type:uuid;index" json:"purchase_order_id"`
	PurchaseInvoiceID       string         `gorm:"type:uuid;not null;index" json:"purchase_invoice_id"`
	PurchaseReceiptID       string         `gorm:"type:uuid;not null;index" json:"purchase_receipt_id"`
	ReturnNumber            string         `gorm:"size:100;not null" json:"return_number"`
	ReturnDate              time.Time      `gorm:"type:date;not null" json:"return_date"`
	SupplierReferenceNumber string         `gorm:"size:255" json:"supplier_reference_number"`
	Reason                  string         `json:"reason"`
	Status                  string         `gorm:"size:50;not null;default:draft" json:"status"`
	SubtotalAmount          float64        `gorm:"not null;default:0" json:"subtotal_amount"`
	TaxAmount               float64        `gorm:"not null;default:0" json:"tax_amount"`
	DiscountAmount          float64        `gorm:"not null;default:0" json:"discount_amount"`
	ReturnTotal             float64        `gorm:"not null;default:0" json:"return_total"`
	AppliedCreditAmount     float64        `gorm:"not null;default:0" json:"applied_credit_amount"`
	OpenCreditAmount        float64        `gorm:"not null;default:0" json:"open_credit_amount"`
	JournalEntryID          *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	CreatedByUserID         string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	PostedByUserID          *string        `gorm:"type:uuid;index" json:"posted_by_user_id"`
	PostedAt                *time.Time     `json:"posted_at"`
	CancelledByUserID       *string        `gorm:"type:uuid;index" json:"cancelled_by_user_id"`
	CancelledAt             *time.Time     `json:"cancelled_at"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseReturn) TableName() string { return "purchase_returns" }

type PurchaseReturnItem struct {
	ID                    string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID            string         `gorm:"type:uuid;not null;index" json:"business_id"`
	PurchaseReturnID      string         `gorm:"type:uuid;not null;index" json:"purchase_return_id"`
	PurchaseReceiptItemID string         `gorm:"type:uuid;not null;index" json:"purchase_receipt_item_id"`
	ItemType              string         `gorm:"size:50;not null" json:"item_type"`
	ProductID             *string        `gorm:"type:uuid;index" json:"product_id"`
	IngredientID          *string        `gorm:"type:uuid;index" json:"ingredient_id"`
	PackagingItemID       *string        `gorm:"type:uuid;index" json:"packaging_item_id"`
	InventoryItemID       string         `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	ItemNameSnapshot      string         `gorm:"size:255;not null" json:"item_name_snapshot"`
	Quantity              float64        `gorm:"not null" json:"quantity"`
	UnitID                string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCost              float64        `gorm:"not null;default:0" json:"unit_cost"`
	DiscountAmount        float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID             *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxAmount             float64        `gorm:"not null;default:0" json:"tax_amount"`
	LineSubtotal          float64        `gorm:"not null;default:0" json:"line_subtotal"`
	LineTotal             float64        `gorm:"not null;default:0" json:"line_total"`
	StockLocationID       *string        `gorm:"type:uuid;index" json:"stock_location_id"`
	StockMovementID       *string        `gorm:"type:uuid;index" json:"stock_movement_id"`
	Reason                string         `json:"reason"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PurchaseReturnItem) TableName() string { return "purchase_return_items" }
