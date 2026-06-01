package masterdata

import (
	"time"

	"gorm.io/gorm"
)

type ProductCategory struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID         string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ParentCategoryID *string        `gorm:"type:uuid;index" json:"parent_category_id"`
	CategoryName     string         `gorm:"size:255;not null" json:"category_name"`
	CategoryCode     string         `gorm:"size:100;not null" json:"category_code"`
	Description      string         `gorm:"size:500" json:"description"`
	ImageFileID      string         `gorm:"size:500" json:"image_file_id"`
	SortOrder        int            `gorm:"not null;default:0" json:"sort_order"`
	Status           string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ProductCategory) TableName() string {
	return "product_categories"
}

type UnitCategory struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Description string    `gorm:"size:255" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (UnitCategory) TableName() string {
	return "unit_categories"
}

type Unit struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       *string        `gorm:"type:uuid;index" json:"business_id"`
	UnitCategoryID   string         `gorm:"type:uuid;not null;index" json:"unit_category_id"`
	UnitCategory     UnitCategory   `gorm:"foreignKey:UnitCategoryID" json:"unit_category"`
	UnitName         string         `gorm:"size:100;not null" json:"unit_name"`
	Symbol           string         `gorm:"size:50;not null" json:"symbol"`
	BaseUnitID       *string        `gorm:"type:uuid;index" json:"base_unit_id"`
	ConversionFactor float64        `gorm:"not null;default:1" json:"conversion_factor"`
	DecimalPrecision int            `gorm:"not null;default:2" json:"decimal_precision"`
	IsSystemDefault  bool           `gorm:"not null;default:false" json:"is_system_default"`
	Status           string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Unit) TableName() string {
	return "units"
}

type OrderStatus struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      *string        `gorm:"type:uuid;index" json:"business_id"`
	StatusName      string         `gorm:"size:100;not null" json:"status_name"`
	StatusKey       string         `gorm:"size:100;not null" json:"status_key"`
	SortOrder       int            `gorm:"not null;default:0" json:"sort_order"`
	Color           string         `gorm:"size:50" json:"color"`
	IsSystemDefault bool           `gorm:"not null;default:false" json:"is_system_default"`
	IsFinalStatus   bool           `gorm:"not null;default:false" json:"is_final_status"`
	Status          string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (OrderStatus) TableName() string {
	return "order_statuses"
}

type PaymentStatus struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      *string        `gorm:"type:uuid;index" json:"business_id"`
	StatusName      string         `gorm:"size:100;not null" json:"status_name"`
	StatusKey       string         `gorm:"size:100;not null" json:"status_key"`
	Color           string         `gorm:"size:50" json:"color"`
	IsSystemDefault bool           `gorm:"not null;default:false" json:"is_system_default"`
	Status          string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PaymentStatus) TableName() string {
	return "payment_statuses"
}

type IngredientCategory struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID     string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CategoryName string         `gorm:"size:255;not null" json:"category_name"`
	Description  string         `gorm:"size:500" json:"description"`
	Status       string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (IngredientCategory) TableName() string {
	return "ingredient_categories"
}

type PackagingCategory struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID     string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CategoryName string         `gorm:"size:255;not null" json:"category_name"`
	Description  string         `gorm:"size:500" json:"description"`
	Status       string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PackagingCategory) TableName() string {
	return "packaging_categories"
}
