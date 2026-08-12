package bakeryorders

import (
	"time"

	"gorm.io/gorm"
)

type BakeryOrder struct {
	ID                       string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID               string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                 string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	OrderNumber              string         `gorm:"size:100;not null" json:"order_number"`
	CustomerID               *string        `gorm:"type:uuid;index" json:"customer_id"`
	SalesChannelID           *string        `gorm:"type:uuid;index" json:"sales_channel_id"`
	SalesChannelNameSnapshot string         `gorm:"size:150;not null;default:''" json:"sales_channel_name_snapshot"`
	ExternalOrderNumber      string         `gorm:"size:150;not null;default:''" json:"external_order_number"`
	CustomerNameSnapshot     string         `gorm:"size:255" json:"customer_name_snapshot"`
	CustomerPhoneSnapshot    string         `gorm:"size:100" json:"customer_phone_snapshot"`
	OrderType                string         `gorm:"size:50;not null" json:"order_type"`
	OrderDate                time.Time      `gorm:"type:date;not null" json:"order_date"`
	EventDate                time.Time      `gorm:"type:date;not null" json:"event_date"`
	PickupTime               string         `gorm:"size:20" json:"pickup_time"`
	DeliveryTime             string         `gorm:"size:20" json:"delivery_time"`
	DeliveryAddress          string         `json:"delivery_address"`
	SubtotalAmount           float64        `gorm:"not null;default:0" json:"subtotal_amount"`
	DiscountAmount           float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxAmount                float64        `gorm:"not null;default:0" json:"tax_amount"`
	ChargeAmount             float64        `gorm:"not null;default:0" json:"charge_amount"`
	ChargeTaxAmount          float64        `gorm:"not null;default:0" json:"charge_tax_amount"`
	TotalAmount              float64        `gorm:"not null;default:0" json:"total_amount"`
	PaidAmount               float64        `gorm:"not null;default:0" json:"paid_amount"`
	BalanceAmount            float64        `gorm:"not null;default:0" json:"balance_amount"`
	PaymentStatus            string         `gorm:"size:50;not null;default:unpaid" json:"payment_status"`
	OrderStatus              string         `gorm:"size:50;not null;default:new" json:"order_status"`
	AccountingJournalEntryID *string        `gorm:"type:uuid;index" json:"accounting_journal_entry_id"`
	COGSJournalEntryID       *string        `gorm:"type:uuid;index" json:"cogs_journal_entry_id"`
	COGSReversalJournalID    *string        `gorm:"type:uuid;index;column:cogs_reversal_journal_entry_id" json:"cogs_reversal_journal_entry_id"`
	Notes                    string         `json:"notes"`
	CreatedByUserID          string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID          string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`
	DeletedAt                gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (BakeryOrder) TableName() string { return "bakery_orders" }

type BakeryOrderItem struct {
	ID                         string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                 string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BakeryOrderID              string         `gorm:"type:uuid;not null;index" json:"bakery_order_id"`
	ProductID                  *string        `gorm:"type:uuid;index" json:"product_id"`
	ProductVariantID           *string        `gorm:"type:uuid;index" json:"product_variant_id"`
	ProductNameSnapshot        string         `gorm:"size:255;not null" json:"product_name_snapshot"`
	ProductVariantNameSnapshot string         `gorm:"size:255;not null;default:''" json:"product_variant_name_snapshot"`
	ItemNameSnapshot           string         `gorm:"size:255;not null" json:"item_name_snapshot"`
	ItemSource                 string         `gorm:"size:50;not null;default:catalog" json:"item_source"`
	Quantity                   float64        `gorm:"not null" json:"quantity"`
	UnitID                     string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	Weight                     *float64       `json:"weight"`
	Flavor                     string         `gorm:"size:255" json:"flavor"`
	DesignNotes                string         `json:"design_notes"`
	MessageText                string         `json:"message_text"`
	CustomizationsJSON         *string        `gorm:"type:jsonb" json:"customizations_json"`
	UnitPrice                  float64        `gorm:"not null;default:0" json:"unit_price"`
	DiscountAmount             float64        `gorm:"not null;default:0" json:"discount_amount"`
	TaxRateID                  *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxAmount                  float64        `gorm:"not null;default:0" json:"tax_amount"`
	LineTotal                  float64        `gorm:"not null;default:0" json:"line_total"`
	CreatedAt                  time.Time      `json:"created_at"`
	UpdatedAt                  time.Time      `json:"updated_at"`
	DeletedAt                  gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (BakeryOrderItem) TableName() string { return "bakery_order_items" }

type BakeryOrderPayment struct {
	ID                        string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BakeryOrderID             string    `gorm:"type:uuid;not null;index" json:"bakery_order_id"`
	PaymentMethodID           string    `gorm:"type:uuid;not null;index" json:"payment_method_id"`
	PaymentMethodNameSnapshot string    `gorm:"size:255;not null" json:"payment_method_name_snapshot"`
	Amount                    float64   `gorm:"not null" json:"amount"`
	ReferenceNumber           string    `gorm:"size:255" json:"reference_number"`
	PaymentType               string    `gorm:"size:50;not null" json:"payment_type"`
	JournalEntryID            *string   `gorm:"type:uuid;index" json:"journal_entry_id"`
	PaidByUserID              string    `gorm:"type:uuid;not null;index" json:"paid_by_user_id"`
	PaidAt                    time.Time `gorm:"not null" json:"paid_at"`
	CreatedAt                 time.Time `json:"created_at"`
}

func (BakeryOrderPayment) TableName() string { return "bakery_order_payments" }

type BakeryOrderProduction struct {
	ID                string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BakeryOrderID     string    `gorm:"type:uuid;not null;index" json:"bakery_order_id"`
	BakeryOrderItemID *string   `gorm:"type:uuid;index" json:"bakery_order_item_id"`
	ProductionBatchID *string   `gorm:"type:uuid;index" json:"production_batch_id"`
	Status            string    `gorm:"size:50;not null;default:pending" json:"status"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (BakeryOrderProduction) TableName() string { return "bakery_order_productions" }

type BakeryOrderPackaging struct {
	ID                    string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID            string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BakeryOrderID         string    `gorm:"type:uuid;not null;index" json:"bakery_order_id"`
	PackagingItemID       *string   `gorm:"type:uuid;index" json:"packaging_item_id"`
	ComponentProductID    *string   `gorm:"type:uuid;index" json:"component_product_id"`
	ComponentVariantID    *string   `gorm:"type:uuid;index" json:"component_variant_id"`
	PackagingNameSnapshot string    `gorm:"size:255;not null" json:"packaging_name_snapshot"`
	QuantityRequired      float64   `gorm:"not null" json:"quantity_required"`
	UnitID                string    `gorm:"type:uuid;not null;index" json:"unit_id"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

func (BakeryOrderPackaging) TableName() string { return "bakery_order_packaging" }
