package salesreturns

import (
	"time"

	"gorm.io/gorm"
)

type SalesReturn struct {
	ID                      string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID              string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SaleID                  string         `gorm:"type:uuid;not null;index" json:"sale_id"`
	CustomerID              *string        `gorm:"type:uuid;index" json:"customer_id"`
	ReturnNumber            string         `gorm:"size:100;not null" json:"return_number"`
	ReturnDate              time.Time      `gorm:"type:date;not null" json:"return_date"`
	Reason                  string         `json:"reason"`
	Status                  string         `gorm:"size:50;not null;default:draft" json:"status"`
	SubtotalAmount          float64        `gorm:"not null;default:0" json:"subtotal_amount"`
	TaxAmount               float64        `gorm:"not null;default:0" json:"tax_amount"`
	ChargeAmount            float64        `gorm:"not null;default:0" json:"charge_amount"`
	ChargeTaxAmount         float64        `gorm:"not null;default:0" json:"charge_tax_amount"`
	ReturnTotal             float64        `gorm:"not null;default:0" json:"return_total"`
	RefundMode              string         `gorm:"size:50;not null;default:none" json:"refund_mode"`
	RefundPaymentMethodID   *string        `gorm:"type:uuid;index" json:"refund_payment_method_id"`
	RefundAmount            float64        `gorm:"not null;default:0" json:"refund_amount"`
	RefundReferenceNumber   string         `gorm:"size:255" json:"refund_reference_number"`
	PaymentRefundID         *string        `gorm:"type:uuid;index" json:"payment_refund_id"`
	JournalEntryID          *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	InventoryJournalEntryID *string        `gorm:"type:uuid;index" json:"inventory_journal_entry_id"`
	ApprovedByUserID        *string        `gorm:"type:uuid;index" json:"approved_by_user_id"`
	CreatedByUserID         string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	PostedByUserID          *string        `gorm:"type:uuid;index" json:"posted_by_user_id"`
	PostedAt                *time.Time     `json:"posted_at"`
	CancelledByUserID       *string        `gorm:"type:uuid;index" json:"cancelled_by_user_id"`
	CancelledAt             *time.Time     `json:"cancelled_at"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (SalesReturn) TableName() string {
	return "sales_returns"
}

type SalesReturnItem struct {
	ID                        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string         `gorm:"type:uuid;not null;index" json:"business_id"`
	SalesReturnID             string         `gorm:"type:uuid;not null;index" json:"sales_return_id"`
	SaleItemID                string         `gorm:"type:uuid;not null;index" json:"sale_item_id"`
	ProductID                 string         `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVariantID          *string        `gorm:"type:uuid;index" json:"product_variant_id"`
	ProductNameSnapshot       string         `gorm:"size:255;not null" json:"product_name_snapshot"`
	VariantNameSnapshot       string         `gorm:"size:255" json:"variant_name_snapshot"`
	SKUSnapshot               string         `gorm:"size:150" json:"sku_snapshot"`
	Quantity                  float64        `gorm:"not null" json:"quantity"`
	UnitPrice                 float64        `gorm:"not null" json:"unit_price"`
	DiscountAmount            float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID                 *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxRateNameSnapshot       string         `gorm:"size:150" json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64        `gorm:"not null;default:0" json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64        `gorm:"not null;default:0" json:"tax_amount"`
	LineSubtotal              float64        `gorm:"not null;default:0" json:"line_subtotal"`
	LineTotal                 float64        `gorm:"not null;default:0" json:"line_total"`
	RestockAction             string         `gorm:"size:50;not null" json:"restock_action"`
	StockLocationID           *string        `gorm:"type:uuid;index" json:"stock_location_id"`
	StockMovementID           *string        `gorm:"type:uuid;index" json:"stock_movement_id"`
	Reason                    string         `json:"reason"`
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (SalesReturnItem) TableName() string {
	return "sales_return_items"
}
