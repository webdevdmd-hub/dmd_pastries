package settings

import (
	"time"

	"gorm.io/gorm"
)

type CompanySettings struct {
	ID                  string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID          string         `gorm:"type:uuid;not null;uniqueIndex" json:"business_id"`
	BusinessDisplayName string         `gorm:"size:255;not null" json:"business_display_name"`
	LogoFileID          string         `gorm:"size:500" json:"logo_file_id"`
	Address             string         `gorm:"size:500" json:"address"`
	Phone               string         `gorm:"size:100" json:"phone"`
	Email               string         `gorm:"size:255" json:"email"`
	Website             string         `gorm:"size:255" json:"website"`
	VATNumber           string         `gorm:"size:100" json:"vat_number"`
	Currency            string         `gorm:"size:10;not null" json:"currency"`
	Timezone            string         `gorm:"size:100;not null" json:"timezone"`
	InvoiceFooter       string         `gorm:"size:500" json:"invoice_footer"`
	ReceiptFooter       string         `gorm:"size:500" json:"receipt_footer"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (CompanySettings) TableName() string {
	return "company_settings"
}

type TaxRate struct {
	ID             string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID     string         `gorm:"type:uuid;not null;index" json:"business_id"`
	TaxName        string         `gorm:"size:150;not null" json:"tax_name"`
	TaxType        string         `gorm:"size:50;not null" json:"tax_type"`
	RatePercentage float64        `gorm:"not null" json:"rate_percentage"`
	IsInclusive    bool           `gorm:"not null;default:false" json:"is_inclusive"`
	Country        string         `gorm:"size:100" json:"country"`
	Region         string         `gorm:"size:100" json:"region"`
	IsDefault      bool           `gorm:"not null;default:false" json:"is_default"`
	Status         string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (TaxRate) TableName() string {
	return "tax_rates"
}

type PaymentMethod struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string         `gorm:"type:uuid;not null;index" json:"business_id"`
	MethodName        string         `gorm:"size:150;not null" json:"method_name"`
	MethodType        string         `gorm:"size:50;not null" json:"method_type"`
	IsDefault         bool           `gorm:"not null;default:false" json:"is_default"`
	AllowSplitPayment bool           `gorm:"not null;default:true" json:"allow_split_payment"`
	RequiresReference bool           `gorm:"not null;default:false" json:"requires_reference"`
	Status            string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PaymentMethod) TableName() string {
	return "payment_methods"
}

type ReceiptLayout struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID     *string        `gorm:"type:uuid;index" json:"branch_id"`
	LayoutName   string         `gorm:"size:150;not null" json:"layout_name"`
	ReceiptType  string         `gorm:"size:50;not null" json:"receipt_type"`
	PrinterType  string         `gorm:"size:100" json:"printer_type"`
	CounterID    string         `gorm:"size:100" json:"counter_id"`
	IsDefault    bool           `gorm:"not null;default:false" json:"is_default"`
	Status       string         `gorm:"size:50;not null;default:active" json:"status"`
	LayoutConfig string         `gorm:"type:jsonb;not null;default:'{}'" json:"layout_config"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ReceiptLayout) TableName() string {
	return "receipt_layouts"
}
