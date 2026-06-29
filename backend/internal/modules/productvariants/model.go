package productvariants

import (
	"time"

	"gorm.io/gorm"
)

type ProductVariant struct {
	ID                     string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID             string         `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductID              string         `gorm:"type:uuid;not null;index" json:"product_id"`
	VariantName            string         `gorm:"size:255;not null" json:"variant_name"`
	SKU                    string         `gorm:"size:150" json:"sku"`
	Barcode                string         `gorm:"size:150" json:"barcode"`
	SalePrice              float64        `gorm:"not null" json:"sale_price"`
	CostPrice              *float64       `json:"cost_price"`
	CostUpdatePolicy       string         `gorm:"size:50;not null;default:manual" json:"cost_update_policy"`
	PricingType            string         `gorm:"size:30;not null;default:markup" json:"pricing_type"`
	PricingPercent         float64        `gorm:"not null;default:0" json:"pricing_percent"`
	MinimumSalePrice       *float64       `json:"minimum_sale_price"`
	SuggestedSalePrice     *float64       `json:"suggested_sale_price"`
	AutoPriceUpdateEnabled bool           `gorm:"not null;default:false" json:"auto_price_update_enabled"`
	SalePriceLocked        bool           `gorm:"not null;default:false" json:"sale_price_locked"`
	LastPurchaseCost       *float64       `json:"last_purchase_cost"`
	LastPurchaseDate       *time.Time     `json:"last_purchase_date"`
	LastProductionCost     *float64       `json:"last_production_cost"`
	LastProductionDate     *time.Time     `json:"last_production_date"`
	AverageInventoryCost   *float64       `json:"average_inventory_cost"`
	ImageFileID            string         `gorm:"size:500" json:"image_file_id"`
	SortOrder              int            `gorm:"not null;default:0" json:"sort_order"`
	Status                 string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ProductVariant) TableName() string {
	return "product_variants"
}
