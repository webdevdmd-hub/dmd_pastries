package pos

import (
	"time"

	"gorm.io/gorm"
)

type Sale struct {
	ID                       string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID               string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                 string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CashierUserID            string         `gorm:"type:uuid;not null;index" json:"cashier_user_id"`
	CustomerID               *string        `gorm:"type:uuid;index" json:"customer_id"`
	SalesChannelID           *string        `gorm:"type:uuid;index" json:"sales_channel_id"`
	SalesChannelNameSnapshot string         `gorm:"size:150;not null;default:''" json:"sales_channel_name_snapshot"`
	ExternalOrderNumber      string         `gorm:"size:150;not null;default:''" json:"external_order_number"`
	SaleNumber               string         `gorm:"size:100;not null" json:"sale_number"`
	SubtotalAmount           float64        `gorm:"not null;default:0" json:"subtotal_amount"`
	DiscountType             *string        `gorm:"size:50" json:"discount_type"`
	DiscountValue            float64        `gorm:"not null;default:0" json:"discount_value"`
	DiscountAmount           float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxableAmount            float64        `gorm:"not null;default:0" json:"taxable_amount"`
	TaxAmount                float64        `gorm:"not null;default:0" json:"tax_amount"`
	ChargeAmount             float64        `gorm:"not null;default:0" json:"charge_amount"`
	ChargeTaxAmount          float64        `gorm:"not null;default:0" json:"charge_tax_amount"`
	TotalAmount              float64        `gorm:"not null;default:0" json:"total_amount"`
	PaidAmount               float64        `gorm:"not null;default:0" json:"paid_amount"`
	ChangeAmount             float64        `gorm:"not null;default:0" json:"change_amount"`
	PaymentStatus            string         `gorm:"size:50;not null;default:unpaid" json:"payment_status"`
	SaleStatus               string         `gorm:"size:50;not null;default:completed" json:"sale_status"`
	AccountingJournalEntryID *string        `gorm:"type:uuid;index" json:"accounting_journal_entry_id"`
	COGSJournalEntryID       *string        `gorm:"type:uuid;index" json:"cogs_journal_entry_id"`
	VoidJournalEntryID       *string        `gorm:"type:uuid;index" json:"void_journal_entry_id"`
	Notes                    string         `json:"notes"`
	SoldAt                   time.Time      `gorm:"not null" json:"sold_at"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`
	DeletedAt                gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Sale) TableName() string {
	return "sales"
}

type SaleItem struct {
	ID                        string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string    `gorm:"type:uuid;not null;index" json:"business_id"`
	SaleID                    string    `gorm:"type:uuid;not null;index" json:"sale_id"`
	ProductID                 string    `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVariantID          *string   `gorm:"type:uuid;index" json:"product_variant_id"`
	ProductNameSnapshot       string    `gorm:"size:255;not null" json:"product_name_snapshot"`
	VariantNameSnapshot       string    `gorm:"size:255" json:"variant_name_snapshot"`
	SKUSnapshot               string    `gorm:"size:150" json:"sku_snapshot"`
	Quantity                  float64   `gorm:"not null" json:"quantity"`
	UnitPrice                 float64   `gorm:"not null" json:"unit_price"`
	DiscountAmount            float64   `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID                 *string   `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxRateNameSnapshot       string    `gorm:"size:150" json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64   `gorm:"not null;default:0" json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64   `gorm:"not null;default:0" json:"tax_amount"`
	LineSubtotal              float64   `gorm:"not null;default:0" json:"line_subtotal"`
	LineTotal                 float64   `gorm:"not null;default:0" json:"line_total"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

func (SaleItem) TableName() string {
	return "sale_items"
}

type SalePayment struct {
	ID                        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                  string         `gorm:"type:uuid;index" json:"branch_id"`
	SaleID                    string         `gorm:"type:uuid;not null;index" json:"sale_id"`
	PaymentMethodID           string         `gorm:"type:uuid;not null;index" json:"payment_method_id"`
	PaymentMethodNameSnapshot string         `gorm:"size:150;not null" json:"payment_method_name_snapshot"`
	PaymentMethodTypeSnapshot string         `gorm:"size:50" json:"payment_method_type_snapshot"`
	Amount                    float64        `gorm:"not null" json:"amount"`
	ReferenceNumber           string         `gorm:"size:255" json:"reference_number"`
	ProviderTransactionID     string         `gorm:"size:255" json:"provider_transaction_id"`
	PaymentStatus             string         `gorm:"size:50;not null;default:completed" json:"payment_status"`
	JournalEntryID            *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	PaidByUserID              string         `gorm:"type:uuid;index" json:"paid_by_user_id"`
	Notes                     string         `json:"notes"`
	PaidAt                    time.Time      `gorm:"not null" json:"paid_at"`
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (SalePayment) TableName() string {
	return "sale_payments"
}

type SaleRefund struct {
	ID               string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string    `gorm:"type:uuid;not null;index" json:"business_id"`
	SaleID           string    `gorm:"type:uuid;not null;index" json:"sale_id"`
	RefundNumber     string    `gorm:"size:100;not null" json:"refund_number"`
	RefundAmount     float64   `gorm:"not null" json:"refund_amount"`
	Reason           string    `gorm:"not null" json:"reason"`
	ApprovedByUserID *string   `gorm:"type:uuid;index" json:"approved_by_user_id"`
	CreatedByUserID  string    `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (SaleRefund) TableName() string {
	return "sale_refunds"
}

type SaleVoid struct {
	ID               string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string    `gorm:"type:uuid;not null;index" json:"business_id"`
	SaleID           string    `gorm:"type:uuid;not null;index" json:"sale_id"`
	Reason           string    `gorm:"not null" json:"reason"`
	ApprovedByUserID *string   `gorm:"type:uuid;index" json:"approved_by_user_id"`
	CreatedByUserID  string    `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt        time.Time `json:"created_at"`
}

func (SaleVoid) TableName() string {
	return "sale_voids"
}

type HeldSale struct {
	ID                       string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID               string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                 string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CashierUserID            string         `gorm:"type:uuid;not null;index" json:"cashier_user_id"`
	CustomerID               *string        `gorm:"type:uuid;index" json:"customer_id"`
	HoldNumber               string         `gorm:"size:100;not null" json:"hold_number"`
	ItemCount                int            `gorm:"not null;default:0" json:"item_count"`
	EstimatedSubtotal        float64        `gorm:"not null;default:0" json:"estimated_subtotal"`
	EstimatedDiscountAmount  float64        `gorm:"not null;default:0" json:"estimated_discount_amount"`
	EstimatedTaxAmount       float64        `gorm:"not null;default:0" json:"estimated_tax_amount"`
	EstimatedChargeAmount    float64        `gorm:"not null;default:0" json:"estimated_charge_amount"`
	EstimatedChargeTaxAmount float64        `gorm:"not null;default:0" json:"estimated_charge_tax_amount"`
	EstimatedTotal           float64        `gorm:"not null;default:0" json:"estimated_total"`
	Status                   string         `gorm:"size:50;not null;default:held" json:"status"`
	Notes                    string         `json:"notes"`
	HeldAt                   time.Time      `gorm:"not null" json:"held_at"`
	ResumedAt                *time.Time     `json:"resumed_at"`
	CancelledAt              *time.Time     `json:"cancelled_at"`
	ExpiresAt                *time.Time     `json:"expires_at"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`
	DeletedAt                gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (HeldSale) TableName() string {
	return "held_sales"
}

type HeldSaleItem struct {
	ID                        string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string    `gorm:"type:uuid;not null;index" json:"business_id"`
	HeldSaleID                string    `gorm:"type:uuid;not null;index" json:"held_sale_id"`
	ProductID                 string    `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVariantID          *string   `gorm:"type:uuid;index" json:"product_variant_id"`
	ProductNameSnapshot       string    `gorm:"size:255;not null" json:"product_name_snapshot"`
	VariantNameSnapshot       string    `gorm:"size:255" json:"variant_name_snapshot"`
	SKUSnapshot               string    `gorm:"size:150" json:"sku_snapshot"`
	Quantity                  float64   `gorm:"not null" json:"quantity"`
	UnitPrice                 float64   `gorm:"not null" json:"unit_price"`
	DiscountType              *string   `gorm:"size:50" json:"discount_type"`
	DiscountValue             float64   `gorm:"not null;default:0" json:"discount_value"`
	DiscountAmount            float64   `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID                 *string   `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxRateNameSnapshot       string    `gorm:"size:150" json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64   `gorm:"not null;default:0" json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64   `gorm:"not null;default:0" json:"tax_amount"`
	LineSubtotal              float64   `gorm:"not null;default:0" json:"line_subtotal"`
	LineTotal                 float64   `gorm:"not null;default:0" json:"line_total"`
	SortOrder                 int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

func (HeldSaleItem) TableName() string {
	return "held_sale_items"
}
