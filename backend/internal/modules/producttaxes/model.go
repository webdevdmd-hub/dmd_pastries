package producttaxes

import "time"

type ProductTax struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string    `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductID  string    `gorm:"type:uuid;not null;index" json:"product_id"`
	TaxRateID  string    `gorm:"type:uuid;not null;index" json:"tax_rate_id"`
	IsDefault  bool      `gorm:"not null;default:false" json:"is_default"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (ProductTax) TableName() string {
	return "product_taxes"
}
