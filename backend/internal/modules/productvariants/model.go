package productvariants

import (
	"time"

	"gorm.io/gorm"
)

type ProductVariant struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID  string         `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductID   string         `gorm:"type:uuid;not null;index" json:"product_id"`
	VariantName string         `gorm:"size:255;not null" json:"variant_name"`
	SKU         string         `gorm:"size:150" json:"sku"`
	Barcode     string         `gorm:"size:150" json:"barcode"`
	SalePrice   float64        `gorm:"not null" json:"sale_price"`
	CostPrice   *float64       `json:"cost_price"`
	ImageFileID string         `gorm:"size:500" json:"image_file_id"`
	SortOrder   int            `gorm:"not null;default:0" json:"sort_order"`
	Status      string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ProductVariant) TableName() string {
	return "product_variants"
}
