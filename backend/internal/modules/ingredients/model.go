package ingredients

import (
	"pastries-pos/internal/shared/money"
	"time"

	"gorm.io/gorm"
)

type Ingredient struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID           string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID             string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	IngredientCategoryID string         `gorm:"type:uuid;not null;index" json:"ingredient_category_id"`
	SupplierID           *string        `gorm:"type:uuid;index" json:"supplier_id"`
	IngredientName       string         `gorm:"size:255;not null" json:"ingredient_name"`
	IngredientCode       string         `gorm:"size:100;not null" json:"ingredient_code"`
	Description          string         `json:"description"`
	UnitID               string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	CostPerUnit          money.Amount   `gorm:"not null;default:0" json:"cost_per_unit"`
	IsStockTracked       bool           `gorm:"not null;default:true" json:"is_stock_tracked"`
	IsExpiryTracked      bool           `gorm:"not null;default:true" json:"is_expiry_tracked"`
	ReorderLevel         money.Amount   `gorm:"not null;default:0" json:"reorder_level"`
	ImageURL             *string        `gorm:"size:500" json:"image_url"`
	ImageFileID          string         `gorm:"size:500" json:"image_file_id"`
	Status               string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedByUserID      string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID      string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Ingredient) TableName() string { return "ingredients" }
