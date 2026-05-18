package manufacturing

import (
	"time"

	"gorm.io/gorm"
)

type ProductionBatch struct {
	ID                    string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID            string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID              string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	RecipeID              string         `gorm:"type:uuid;not null;index" json:"recipe_id"`
	ProductID             string         `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVariantID      *string        `gorm:"type:uuid;index" json:"product_variant_id"`
	ProductionBatchNumber string         `gorm:"size:100;not null" json:"production_batch_number"`
	PlannedQuantity       float64        `gorm:"not null" json:"planned_quantity"`
	ProducedQuantity      float64        `gorm:"not null;default:0" json:"produced_quantity"`
	YieldUnitID           string         `gorm:"type:uuid;not null;index" json:"yield_unit_id"`
	Status                string         `gorm:"size:50;not null;default:draft" json:"status"`
	ProductionDate        time.Time      `gorm:"type:date;not null" json:"production_date"`
	StartedAt             *time.Time     `json:"started_at"`
	CompletedAt           *time.Time     `json:"completed_at"`
	CancelledAt           *time.Time     `json:"cancelled_at"`
	IngredientCost        float64        `gorm:"not null;default:0" json:"ingredient_cost"`
	PackagingCost         float64        `gorm:"not null;default:0" json:"packaging_cost"`
	TotalProductionCost   float64        `gorm:"not null;default:0" json:"total_production_cost"`
	CostPerUnit           float64        `gorm:"not null;default:0" json:"cost_per_unit"`
	WastageQuantity       float64        `gorm:"not null;default:0" json:"wastage_quantity"`
	WastageReason         string         `json:"wastage_reason"`
	Notes                 string         `json:"notes"`
	CreatedByUserID       string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID       string         `gorm:"type:uuid;not null;index" json:"updated_by_user_id"`
	CompletedByUserID     *string        `gorm:"type:uuid;index" json:"completed_by_user_id"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ProductionBatch) TableName() string { return "production_batches" }

type ProductionIngredientConsumption struct {
	ID                 string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID         string    `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductionBatchID  string    `gorm:"type:uuid;not null;index" json:"production_batch_id"`
	InventoryItemID    string    `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	RecipeIngredientID string    `gorm:"type:uuid;not null;index" json:"recipe_ingredient_id"`
	ItemNameSnapshot   string    `gorm:"size:255;not null" json:"item_name_snapshot"`
	PlannedQuantity    float64   `gorm:"not null" json:"planned_quantity"`
	ActualQuantity     float64   `gorm:"not null" json:"actual_quantity"`
	UnitID             string    `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCostSnapshot   float64   `gorm:"not null;default:0" json:"unit_cost_snapshot"`
	TotalCost          float64   `gorm:"not null;default:0" json:"total_cost"`
	WastageQuantity    float64   `gorm:"not null;default:0" json:"wastage_quantity"`
	StockMovementID    *string   `gorm:"type:uuid;index" json:"stock_movement_id"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (ProductionIngredientConsumption) TableName() string {
	return "production_ingredient_consumptions"
}

type ProductionPackagingConsumption struct {
	ID                    string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID            string    `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductionBatchID     string    `gorm:"type:uuid;not null;index" json:"production_batch_id"`
	PackagingItemID       string    `gorm:"type:uuid;not null;index" json:"packaging_item_id"`
	RecipePackagingID     string    `gorm:"type:uuid;not null;index" json:"recipe_packaging_id"`
	PackagingNameSnapshot string    `gorm:"size:255;not null" json:"packaging_name_snapshot"`
	PlannedQuantity       float64   `gorm:"not null" json:"planned_quantity"`
	ActualQuantity        float64   `gorm:"not null" json:"actual_quantity"`
	UnitID                string    `gorm:"type:uuid;not null;index" json:"unit_id"`
	UnitCostSnapshot      float64   `gorm:"not null;default:0" json:"unit_cost_snapshot"`
	TotalCost             float64   `gorm:"not null;default:0" json:"total_cost"`
	IsOptional            bool      `gorm:"not null;default:false" json:"is_optional"`
	StockMovementID       *string   `gorm:"type:uuid;index" json:"stock_movement_id"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

func (ProductionPackagingConsumption) TableName() string {
	return "production_packaging_consumptions"
}

type ProductionOutput struct {
	ID                string     `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string     `gorm:"type:uuid;not null;index" json:"business_id"`
	ProductionBatchID string     `gorm:"type:uuid;not null;index" json:"production_batch_id"`
	ProductID         string     `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVariantID  *string    `gorm:"type:uuid;index" json:"product_variant_id"`
	InventoryItemID   string     `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	ProducedQuantity  float64    `gorm:"not null" json:"produced_quantity"`
	UnitID            string     `gorm:"type:uuid;not null;index" json:"unit_id"`
	BatchNumber       string     `gorm:"size:100" json:"batch_number"`
	ExpiryDate        *time.Time `gorm:"type:date" json:"expiry_date"`
	StockMovementID   *string    `gorm:"type:uuid;index" json:"stock_movement_id"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (ProductionOutput) TableName() string { return "production_outputs" }
