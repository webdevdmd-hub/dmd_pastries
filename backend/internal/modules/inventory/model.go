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
	ProductVariantID  *string        `gorm:"type:uuid;index" json:"product_variant_id"`
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
	StockLocationID      *string   `gorm:"type:uuid;index" json:"stock_location_id"`
	FromStockLocationID  *string   `gorm:"type:uuid;index" json:"from_stock_location_id"`
	ToStockLocationID    *string   `gorm:"type:uuid;index" json:"to_stock_location_id"`
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

type StockLocation struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	LocationName    string         `gorm:"size:150;not null" json:"location_name"`
	LocationCode    string         `gorm:"size:80;not null" json:"location_code"`
	LocationType    string         `gorm:"size:50" json:"location_type"`
	Description     string         `json:"description"`
	IsDefault       bool           `gorm:"not null;default:false" json:"is_default"`
	Status          string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedByUserID string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID *string        `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (StockLocation) TableName() string {
	return "stock_locations"
}

type InventoryLocationBalance struct {
	ID                string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID          string    `gorm:"type:uuid;not null;index" json:"branch_id"`
	InventoryItemID   string    `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	StockLocationID   string    `gorm:"type:uuid;not null;index" json:"stock_location_id"`
	CurrentQuantity   float64   `gorm:"not null;default:0" json:"current_quantity"`
	ReservedQuantity  float64   `gorm:"not null;default:0" json:"reserved_quantity"`
	AvailableQuantity float64   `gorm:"not null;default:0" json:"available_quantity"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (InventoryLocationBalance) TableName() string {
	return "inventory_location_balances"
}

type StockTransfer struct {
	ID                  string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID          string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID            string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	TransferNumber      string         `gorm:"size:100;not null;index" json:"transfer_number"`
	InventoryItemID     string         `gorm:"type:uuid;not null;index" json:"inventory_item_id"`
	FromStockLocationID string         `gorm:"type:uuid;not null;index" json:"from_stock_location_id"`
	ToStockLocationID   string         `gorm:"type:uuid;not null;index" json:"to_stock_location_id"`
	Quantity            float64        `gorm:"not null" json:"quantity"`
	UnitID              string         `gorm:"type:uuid;not null;index" json:"unit_id"`
	Reason              string         `json:"reason"`
	Notes               string         `json:"notes"`
	Status              string         `gorm:"size:50;not null;default:draft" json:"status"`
	CreatedByUserID     string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CompletedByUserID   *string        `gorm:"type:uuid;index" json:"completed_by_user_id"`
	CompletedAt         *time.Time     `json:"completed_at"`
	CancelledAt         *time.Time     `json:"cancelled_at"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (StockTransfer) TableName() string {
	return "stock_transfers"
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
