package products

import (
	"time"

	"gorm.io/gorm"
)

type Product struct {
	ID                     string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID             string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID               string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CategoryID             string         `gorm:"type:uuid;not null;index" json:"category_id"`
	UnitID                 string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	TaxRateID              *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	ProductName            string         `gorm:"size:255;not null" json:"product_name"`
	ProductCode            string         `gorm:"size:100;not null" json:"product_code"`
	SKU                    string         `gorm:"size:150" json:"sku"`
	Barcode                string         `gorm:"size:150" json:"barcode"`
	Description            string         `gorm:"size:1000" json:"description"`
	ProductType            string         `gorm:"size:50;not null" json:"product_type"`
	SalePrice              float64        `gorm:"not null" json:"sale_price"`
	CostPrice              *float64       `json:"cost_price"`
	CompareAtPrice         *float64       `json:"compare_at_price"`
	ImageFileID            string         `gorm:"size:500" json:"image_file_id"`
	IsPOSVisible           bool           `gorm:"not null;default:true" json:"is_pos_visible"`
	IsStockTracked         bool           `gorm:"not null;default:false" json:"is_stock_tracked"`
	IsExpiryTracked        bool           `gorm:"not null;default:false" json:"is_expiry_tracked"`
	IsCustomOrderAvailable bool           `gorm:"not null;default:false" json:"is_custom_order_available"`
	PreparationTimeMinutes *int           `json:"preparation_time_minutes"`
	Status                 string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedBy              string         `gorm:"type:uuid;not null;index" json:"created_by"`
	UpdatedBy              string         `gorm:"type:uuid;not null;index" json:"updated_by"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Product) TableName() string {
	return "products"
}

type ProductMedia struct {
	ID         string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID   string         `gorm:"type:uuid;index" json:"branch_id"`
	ProductID  string         `gorm:"type:uuid;not null;index" json:"product_id"`
	FileID     string         `gorm:"size:500;not null" json:"file_id"`
	BucketID   string         `gorm:"size:150" json:"bucket_id"`
	FileType   string         `gorm:"size:100;not null" json:"file_type"`
	AltText    string         `gorm:"size:255" json:"alt_text"`
	SortOrder  int            `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ProductMedia) TableName() string {
	return "product_media"
}
