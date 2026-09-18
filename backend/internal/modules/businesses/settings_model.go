package businesses

import "time"

// BusinessSettings has no gorm default on LowStockAlert: GORM writes a tag default in place of
// false, so an "off" choice was saved "on". The column defaults live in the
// migrations. (ISSUE-063)
type BusinessSettings struct {
	ID                 string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID         string    `gorm:"type:uuid;not null;uniqueIndex" json:"business_id"`
	ReceiptFooter      string    `gorm:"size:500" json:"receipt_footer"`
	AllowNegativeStock bool      `gorm:"not null;default:false" json:"allow_negative_stock"`
	DefaultTaxRate     float64   `gorm:"not null;default:0" json:"default_tax_rate"`
	PriceIncludesTax   bool      `gorm:"not null;default:false" json:"price_includes_tax"`
	DefaultTaxMode     string    `gorm:"size:20;not null;default:inclusive" json:"default_tax_mode"`
	LowStockAlert      bool      `gorm:"not null" json:"low_stock_alert"`
	DefaultLanguage    string    `gorm:"size:20;not null;default:en" json:"default_language"`
	DateFormat         string    `gorm:"size:50;not null;default:YYYY-MM-DD" json:"date_format"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (BusinessSettings) TableName() string {
	return "business_settings"
}
