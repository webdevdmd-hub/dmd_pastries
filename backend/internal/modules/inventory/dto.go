package inventory

import "time"

type InventoryListQuery struct {
	Search               string
	BranchID             string
	ItemType             string
	Status               string
	LowStockOnly         bool
	ExpiryTracked        *bool
	IncludeUninitialized bool
	Page                 int
	Limit                int
	SortBy               string
	SortOrder            string
}

type MovementListQuery struct {
	Search            string
	BranchID          string
	InventoryItemID   string
	ItemType          string
	MovementType      string
	MovementDirection string
	ReferenceType     string
	ReferenceID       string
	DateFrom          string
	DateTo            string
	CreatedByUserID   string
	Page              int
	Limit             int
	SortBy            string
	SortOrder         string
}

type StockLocationListQuery struct {
	Search       string
	BranchID     string
	Status       string
	LocationType string
	Page         int
	Limit        int
	SortBy       string
	SortOrder    string
}

type LocationBalanceListQuery struct {
	Search          string
	BranchID        string
	ItemType        string
	StockLocationID string
	Page            int
	Limit           int
	SortBy          string
	SortOrder       string
}

type StockTransferListQuery struct {
	Search          string
	BranchID        string
	InventoryItemID string
	Status          string
	Page            int
	Limit           int
	SortBy          string
	SortOrder       string
}

type OpeningStockRequest struct {
	BranchID         string  `json:"branch_id" binding:"required"`
	ItemType         string  `json:"item_type" binding:"required"`
	ProductID        string  `json:"product_id"`
	ProductVariantID string  `json:"product_variant_id"`
	IngredientID     string  `json:"ingredient_id"`
	PackagingItemID  string  `json:"packaging_item_id"`
	StockLocationID  string  `json:"stock_location_id"`
	UnitID           string  `json:"unit_id" binding:"required"`
	Quantity         float64 `json:"quantity"`
	UnitCost         float64 `json:"unit_cost"`
	ReorderLevel     float64 `json:"reorder_level"`
	IsExpiryTracked  bool    `json:"is_expiry_tracked"`
	ExpiryDate       string  `json:"expiry_date"`
	Reason           string  `json:"reason"`
}

type StockLocationRequest struct {
	BranchID     string `json:"branch_id"`
	LocationName string `json:"location_name" binding:"required"`
	LocationCode string `json:"location_code" binding:"required"`
	LocationType string `json:"location_type"`
	Description  string `json:"description"`
	IsDefault    bool   `json:"is_default"`
	Status       string `json:"status"`
}

type UpdateStockLocationRequest struct {
	LocationName *string `json:"location_name"`
	LocationCode *string `json:"location_code"`
	LocationType *string `json:"location_type"`
	Description  *string `json:"description"`
}

type UpdateStockLocationStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type StockTransferRequest struct {
	InventoryItemID     string  `json:"inventory_item_id" binding:"required"`
	FromStockLocationID string  `json:"from_stock_location_id" binding:"required"`
	ToStockLocationID   string  `json:"to_stock_location_id" binding:"required"`
	Quantity            float64 `json:"quantity" binding:"required"`
	UnitID              string  `json:"unit_id"`
	Reason              string  `json:"reason"`
	Notes               string  `json:"notes"`
}

type AdjustStockRequest struct {
	AdjustmentType string  `json:"adjustment_type" binding:"required"`
	Quantity       float64 `json:"quantity" binding:"required"`
	Reason         string  `json:"reason" binding:"required"`
}

type ManualStockMovementRequest struct {
	InventoryItemID string  `json:"inventory_item_id" binding:"required"`
	MovementType    string  `json:"movement_type" binding:"required"`
	Quantity        float64 `json:"quantity" binding:"required"`
	UnitCost        float64 `json:"unit_cost"`
	Reason          string  `json:"reason" binding:"required"`
	Notes           string  `json:"notes"`
}

type ReverseStockMovementRequest struct {
	Reason string `json:"reason" binding:"required"`
}

type ExpiryBatchRequest struct {
	BatchNumber  string  `json:"batch_number"`
	Quantity     float64 `json:"quantity" binding:"required"`
	ReceivedDate string  `json:"received_date" binding:"required"`
	ExpiryDate   string  `json:"expiry_date" binding:"required"`
}

type UpdateExpiryBatchRequest struct {
	BatchNumber  *string  `json:"batch_number"`
	Quantity     *float64 `json:"quantity"`
	ReceivedDate *string  `json:"received_date"`
	ExpiryDate   *string  `json:"expiry_date"`
}

type UpdateExpiryBatchStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type InventoryItemResponse struct {
	ID                 string                   `json:"id"`
	BusinessID         string                   `json:"business_id"`
	BranchID           string                   `json:"branch_id"`
	BranchName         string                   `json:"branch_name"`
	ProductID          *string                  `json:"product_id"`
	ProductVariantID   *string                  `json:"product_variant_id"`
	VariantName        string                   `json:"variant_name"`
	IngredientID       *string                  `json:"ingredient_id"`
	PackagingItemID    *string                  `json:"packaging_item_id"`
	ItemType           string                   `json:"item_type"`
	ItemName           string                   `json:"item_name"`
	SKU                string                   `json:"sku"`
	Barcode            string                   `json:"barcode"`
	CurrentQuantity    float64                  `json:"current_quantity"`
	ReservedQuantity   float64                  `json:"reserved_quantity"`
	AvailableQuantity  float64                  `json:"available_quantity"`
	AverageUnitCost    float64                  `json:"average_unit_cost"`
	InventoryValue     float64                  `json:"inventory_value"`
	ReorderLevel       float64                  `json:"reorder_level"`
	Unit               UnitInfo                 `json:"unit"`
	LowStock           bool                     `json:"low_stock"`
	LocationBalances   []LocationBalanceSummary `json:"location_balances,omitempty"`
	IsExpiryTracked    bool                     `json:"is_expiry_tracked"`
	Status             string                   `json:"status"`
	InventoryStatus    string                   `json:"inventory_status"`
	CanAddOpeningStock bool                     `json:"can_add_opening_stock"`
	CreatedAt          time.Time                `json:"created_at"`
	UpdatedAt          time.Time                `json:"updated_at"`
}

type StockLocationResponse struct {
	ID              string    `json:"id"`
	BusinessID      string    `json:"business_id"`
	BranchID        string    `json:"branch_id"`
	BranchName      string    `json:"branch_name"`
	LocationName    string    `json:"location_name"`
	LocationCode    string    `json:"location_code"`
	LocationType    string    `json:"location_type"`
	Description     string    `json:"description"`
	IsDefault       bool      `json:"is_default"`
	Status          string    `json:"status"`
	CreatedByUserID string    `json:"created_by_user_id"`
	UpdatedByUserID *string   `json:"updated_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type PaginatedStockLocationResponse struct {
	Items      []StockLocationResponse `json:"items"`
	Pagination Pagination              `json:"pagination"`
}

type LocationBalanceSummary struct {
	StockLocationID   string  `json:"stock_location_id"`
	StockLocationName string  `json:"stock_location_name"`
	CurrentQuantity   float64 `json:"current_quantity"`
	ReservedQuantity  float64 `json:"reserved_quantity"`
	AvailableQuantity float64 `json:"available_quantity"`
}

type LocationBalanceResponse struct {
	InventoryItemID   string   `json:"inventory_item_id"`
	BranchID          string   `json:"branch_id"`
	BranchName        string   `json:"branch_name"`
	ItemType          string   `json:"item_type"`
	ItemName          string   `json:"item_name"`
	ItemCode          string   `json:"item_code"`
	ProductID         *string  `json:"product_id"`
	ProductVariantID  *string  `json:"product_variant_id"`
	VariantName       string   `json:"variant_name"`
	StockLocationID   string   `json:"stock_location_id"`
	StockLocationName string   `json:"stock_location_name"`
	CurrentQuantity   float64  `json:"current_quantity"`
	ReservedQuantity  float64  `json:"reserved_quantity"`
	AvailableQuantity float64  `json:"available_quantity"`
	Unit              UnitInfo `json:"unit" gorm:"embedded;embeddedPrefix:unit_"`
}

type PaginatedLocationBalanceResponse struct {
	Items      []LocationBalanceResponse `json:"items"`
	Pagination Pagination                `json:"pagination"`
}

type InventoryItemLocationBreakdownResponse struct {
	InventoryItemID     string                   `json:"inventory_item_id"`
	ItemName            string                   `json:"item_name"`
	ItemType            string                   `json:"item_type"`
	BranchID            string                   `json:"branch_id"`
	BranchName          string                   `json:"branch_name"`
	BranchTotalQuantity float64                  `json:"branch_total_quantity"`
	Locations           []LocationBalanceSummary `json:"locations"`
}

type StockTransferResponse struct {
	ID                    string     `json:"id"`
	BusinessID            string     `json:"business_id"`
	BranchID              string     `json:"branch_id"`
	BranchName            string     `json:"branch_name"`
	TransferNumber        string     `json:"transfer_number"`
	InventoryItemID       string     `json:"inventory_item_id"`
	ItemName              string     `json:"item_name"`
	ItemType              string     `json:"item_type"`
	FromStockLocationID   string     `json:"from_stock_location_id"`
	FromStockLocationName string     `json:"from_stock_location_name"`
	ToStockLocationID     string     `json:"to_stock_location_id"`
	ToStockLocationName   string     `json:"to_stock_location_name"`
	Quantity              float64    `json:"quantity"`
	Unit                  UnitInfo   `json:"unit"`
	Reason                string     `json:"reason"`
	Notes                 string     `json:"notes"`
	Status                string     `json:"status"`
	CreatedByUserID       string     `json:"created_by_user_id"`
	CreatedByName         string     `json:"created_by_name"`
	CompletedByUserID     *string    `json:"completed_by_user_id"`
	CompletedAt           *time.Time `json:"completed_at"`
	CancelledAt           *time.Time `json:"cancelled_at"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type PaginatedStockTransferResponse struct {
	Items      []StockTransferResponse `json:"items"`
	Pagination Pagination              `json:"pagination"`
}

type UnitInfo struct {
	ID       string `json:"id"`
	UnitName string `json:"unit_name"`
	Symbol   string `json:"symbol"`
}

type PaginatedInventoryResponse struct {
	Items      []InventoryItemResponse `json:"items"`
	Pagination Pagination              `json:"pagination"`
}

type Pagination struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type StockMovementResponse struct {
	ID                       string    `json:"id"`
	BusinessID               string    `json:"business_id"`
	BranchID                 string    `json:"branch_id"`
	BranchName               string    `json:"branch_name"`
	InventoryItemID          string    `json:"inventory_item_id"`
	StockLocationID          *string   `json:"stock_location_id"`
	StockLocationName        string    `json:"stock_location_name"`
	FromStockLocationID      *string   `json:"from_stock_location_id"`
	FromStockLocationName    string    `json:"from_stock_location_name"`
	ToStockLocationID        *string   `json:"to_stock_location_id"`
	ToStockLocationName      string    `json:"to_stock_location_name"`
	ItemName                 string    `json:"item_name"`
	ItemType                 string    `json:"item_type"`
	ProductID                *string   `json:"product_id"`
	ProductVariantID         *string   `json:"product_variant_id"`
	VariantName              string    `json:"variant_name"`
	MovementType             string    `json:"movement_type"`
	MovementDirection        string    `json:"movement_direction"`
	Quantity                 float64   `json:"quantity"`
	BeforeQuantity           float64   `json:"before_quantity"`
	AfterQuantity            float64   `json:"after_quantity"`
	UnitCostSnapshot         float64   `json:"unit_cost_snapshot"`
	TotalCost                float64   `json:"total_cost"`
	ValuationMethod          string    `json:"valuation_method"`
	AccountingJournalEntryID *string   `json:"accounting_journal_entry_id"`
	Unit                     UnitInfo  `json:"unit"`
	ReferenceType            string    `json:"reference_type"`
	ReferenceID              *string   `json:"reference_id"`
	ReferenceNumber          string    `json:"reference_number"`
	Reason                   string    `json:"reason"`
	Notes                    string    `json:"notes"`
	IsReversal               bool      `json:"is_reversal"`
	ReversedMovementID       *string   `json:"reversed_movement_id"`
	IsReversed               bool      `json:"is_reversed"`
	ReversedByMovementID     *string   `json:"reversed_by_movement_id"`
	CreatedByUserID          string    `json:"created_by_user_id"`
	CreatedByName            string    `json:"created_by_name"`
	CreatedAt                time.Time `json:"created_at"`
}

type PaginatedMovementResponse struct {
	Items      []StockMovementResponse `json:"items"`
	Pagination Pagination              `json:"pagination"`
}

type StockMovementDetailResponse struct {
	Movement           StockMovementResponse  `json:"movement"`
	InventoryItem      InventoryItemResponse  `json:"inventory_item"`
	Reference          map[string]interface{} `json:"reference"`
	Reversal           *StockMovementResponse `json:"reversal"`
	OriginalReversalOf *StockMovementResponse `json:"original_reversal_of"`
}

type StockMovementSummaryResponse struct {
	TotalInQuantity  float64                   `json:"total_in_quantity"`
	TotalOutQuantity float64                   `json:"total_out_quantity"`
	NetQuantity      float64                   `json:"net_quantity"`
	MovementCount    int64                     `json:"movement_count"`
	ByMovementType   []MovementTypeSummaryItem `json:"by_movement_type"`
}

type MovementTypeSummaryItem struct {
	MovementType  string  `json:"movement_type"`
	Direction     string  `json:"direction"`
	TotalQuantity float64 `json:"total_quantity"`
	Count         int64   `json:"count"`
}

type InventoryLedgerAuditResponse struct {
	InventoryItemID                 string  `json:"inventory_item_id"`
	CurrentQuantity                 float64 `json:"current_quantity"`
	CalculatedQuantityFromMovements float64 `json:"calculated_quantity_from_movements"`
	Difference                      float64 `json:"difference"`
	IsBalanced                      bool    `json:"is_balanced"`
	TotalIn                         float64 `json:"total_in"`
	TotalOut                        float64 `json:"total_out"`
	MovementCount                   int64   `json:"movement_count"`
}

type ApplyStockMovementInput struct {
	BusinessID          string
	InventoryItemID     string
	StockLocationID     *string
	FromStockLocationID *string
	ToStockLocationID   *string
	MovementType        string
	Quantity            float64
	UnitCost            float64
	ReferenceType       string
	ReferenceID         *string
	ReferenceNumber     string
	Reason              string
	Notes               string
	IsReversal          bool
	ReversedMovementID  *string
	CreatedByUserID     string
}

type ExpiryBatchResponse struct {
	ID              string    `json:"id"`
	BusinessID      string    `json:"business_id"`
	BranchID        string    `json:"branch_id"`
	InventoryItemID string    `json:"inventory_item_id"`
	BatchNumber     string    `json:"batch_number"`
	Quantity        float64   `json:"quantity"`
	ExpiryDate      time.Time `json:"expiry_date"`
	ReceivedDate    time.Time `json:"received_date"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
