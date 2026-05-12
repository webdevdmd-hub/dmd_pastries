package inventory

import (
	"time"

	"gorm.io/gorm"
)

type InventoryItem struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID          string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ProductID         *string        `gorm:"type:uuid;index" json:"product_id"`
	IngredientID      *string        `gorm:"type:uuid;index" json:"ingredient_id"`
	PackagingItemID   *string        `gorm:"type:uuid;index" json:"packaging_item_id"`
	ItemType          string         `gorm:"size:50;not null" json:"item_type"`
	CurrentQuantity   float64        `gorm:"not null;default:0" json:"current_quantity"`
	ReservedQuantity  float64        `gorm:"not null;default:0" json:"reserved_quantity"`
	AvailableQuantity float64        `gorm:"not null;default:0" json:"available_quantity"`
	ReorderLevel      float64        `gorm:"not null;default:0" json:"reorder_level"`
	UnitID            string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	IsExpiryTracked   bool           `gorm:"not null;default:false" json:"is_expiry_tracked"`
	Status            string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (InventoryItem) TableName() string {
	return "inventory_items"
}

type StockMovement struct {
	ID                   string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID           string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID             string    `gorm:"type:uuid;not null;index" json:"branch_id"`
	InventoryItemID      string    `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	ItemType             string    `gorm:"size:50;not null" json:"item_type"`
	MovementType         string    `gorm:"size:50;not null" json:"movement_type"`
	MovementDirection    string    `gorm:"size:20;not null" json:"movement_direction"`
	Quantity             float64   `gorm:"not null" json:"quantity"`
	BeforeQuantity       float64   `gorm:"not null" json:"before_quantity"`
	AfterQuantity        float64   `gorm:"not null" json:"after_quantity"`
	UnitID               string    `gorm:"type:uuid;not null;index" json:"unit_id"`
	ReferenceType        string    `gorm:"size:100" json:"reference_type"`
	ReferenceID          *string   `gorm:"type:uuid" json:"reference_id"`
	ReferenceNumber      string    `gorm:"size:150" json:"reference_number"`
	Reason               string    `json:"reason"`
	Notes                string    `json:"notes"`
	IsReversal           bool      `gorm:"not null;default:false" json:"is_reversal"`
	ReversedMovementID   *string   `gorm:"type:uuid" json:"reversed_movement_id"`
	IsReversed           bool      `gorm:"not null;default:false" json:"is_reversed"`
	ReversedByMovementID *string   `gorm:"type:uuid" json:"reversed_by_movement_id"`
	CreatedByUserID      string    `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt            time.Time `json:"created_at"`
}

func (StockMovement) TableName() string {
	return "stock_movements"
}

type InventoryAdjustment struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string    `gorm:"type:uuid;not null;index" json:"branch_id"`
	InventoryItemID string    `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	AdjustmentType  string    `gorm:"size:50;not null" json:"adjustment_type"`
	Quantity        float64   `gorm:"not null" json:"quantity"`
	Reason          string    `gorm:"not null" json:"reason"`
	CreatedByUserID string    `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (InventoryAdjustment) TableName() string {
	return "inventory_adjustments"
}

type ExpiryBatch struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	InventoryItemID string         `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	BatchNumber     string         `gorm:"size:100" json:"batch_number"`
	Quantity        float64        `gorm:"not null" json:"quantity"`
	ExpiryDate      time.Time      `gorm:"type:date;not null" json:"expiry_date"`
	ReceivedDate    time.Time      `gorm:"type:date;not null" json:"received_date"`
	Status          string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ExpiryBatch) TableName() string {
	return "expiry_batches"
}
