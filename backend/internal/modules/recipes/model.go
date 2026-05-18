package recipes

import (
	"time"

	"gorm.io/gorm"
)

type Recipe struct {
	ID                      string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID              string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ProductID               string         `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVariantID        *string        `gorm:"type:uuid;index" json:"product_variant_id"`
	RecipeCode              string         `gorm:"size:100;not null" json:"recipe_code"`
	RecipeName              string         `gorm:"size:255;not null" json:"recipe_name"`
	Description             string         `json:"description"`
	BatchYieldQuantity      float64        `gorm:"not null" json:"batch_yield_quantity"`
	BatchYieldUnitID        string         `gorm:"type:uuid;not null;index" json:"batch_yield_unit_id"`
	PreparationTimeMinutes  *int           `json:"preparation_time_minutes"`
	Instructions            string         `json:"instructions"`
	EstimatedIngredientCost float64        `gorm:"not null;default:0" json:"estimated_ingredient_cost"`
	EstimatedPackagingCost  float64        `gorm:"not null;default:0" json:"estimated_packaging_cost"`
	EstimatedTotalCost      float64        `gorm:"not null;default:0" json:"estimated_total_cost"`
	CostPerYieldUnit        float64        `gorm:"not null;default:0" json:"cost_per_yield_unit"`
	VersionNumber           int            `gorm:"not null;default:1" json:"version_number"`
	IsActive                bool           `gorm:"not null;default:false" json:"is_active"`
	Status                  string         `gorm:"size:50;not null;default:draft" json:"status"`
	CreatedByUserID         string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID         string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Recipe) TableName() string { return "recipes" }

type RecipeIngredient struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID          string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	RecipeID          string         `gorm:"type:uuid;not null;index" json:"recipe_id"`
	IngredientID      *string        `gorm:"type:uuid;index" json:"ingredient_id"`
	InventoryItemID   *string        `gorm:"type:uuid;index" json:"inventory_item_id"`
	ItemNameSnapshot  string         `gorm:"size:255;not null" json:"item_name_snapshot"`
	QuantityRequired  float64        `gorm:"not null" json:"quantity_required"`
	UnitID            string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCostSnapshot  float64        `gorm:"not null;default:0" json:"unit_cost_snapshot"`
	TotalCost         float64        `gorm:"not null;default:0" json:"total_cost"`
	WastagePercentage float64        `gorm:"not null;default:0" json:"wastage_percentage"`
	SortOrder         int            `gorm:"not null;default:0" json:"sort_order"`
	Notes             string         `json:"notes"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (RecipeIngredient) TableName() string { return "recipe_ingredients" }

type RecipePackaging struct {
	ID                    string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID            string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID              string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	RecipeID              string         `gorm:"type:uuid;not null;index" json:"recipe_id"`
	PackagingItemID       string         `gorm:"type:uuid;not null;index" json:"packaging_item_id"`
	PackagingNameSnapshot string         `gorm:"size:255;not null" json:"packaging_name_snapshot"`
	QuantityRequired      float64        `gorm:"not null" json:"quantity_required"`
	UnitID                string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCostSnapshot      float64        `gorm:"not null;default:0" json:"unit_cost_snapshot"`
	TotalCost             float64        `gorm:"not null;default:0" json:"total_cost"`
	IsOptional            bool           `gorm:"not null;default:false" json:"is_optional"`
	SortOrder             int            `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (RecipePackaging) TableName() string { return "recipe_packaging" }

type RecipeVersion struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string    `gorm:"type:uuid;not null;index" json:"branch_id"`
	RecipeID        string    `gorm:"type:uuid;not null;index" json:"recipe_id"`
	VersionNumber   int       `gorm:"not null" json:"version_number"`
	ChangeNote      string    `json:"change_note"`
	SnapshotJSON    string    `gorm:"type:jsonb;not null" json:"snapshot_json"`
	CreatedByUserID string    `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
}

func (RecipeVersion) TableName() string { return "recipe_versions" }
