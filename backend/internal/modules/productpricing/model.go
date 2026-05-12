package productpricing

import "time"

type ProductPrice struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string    `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductID  string    `gorm:"type:uuid;not null;index" json:"product_id"`
	VariantID  *string   `gorm:"type:uuid;index" json:"variant_id"`
	PriceType  string    `gorm:"size:50;not null" json:"price_type"`
	Price      float64   `gorm:"not null" json:"price"`
	Currency   string    `gorm:"size:10;not null" json:"currency"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (ProductPrice) TableName() string {
	return "product_prices"
}
