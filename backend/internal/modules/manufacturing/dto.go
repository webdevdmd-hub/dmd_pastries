package manufacturing

import "time"

type BatchListQuery struct {
	Search    string
	BranchID  string
	ProductID string
	RecipeID  string
	Status    string
	DateFrom  string
	DateTo    string
	Page      int
	Limit     int
	SortBy    string
	SortOrder string
}

type CreateBatchRequest struct {
	BranchID        string  `json:"branch_id" binding:"required"`
	RecipeID        string  `json:"recipe_id" binding:"required"`
	PlannedQuantity float64 `json:"planned_quantity" binding:"required"`
	ProductionDate  string  `json:"production_date"`
	Notes           string  `json:"notes"`
}

type CreateProductionRequest struct {
	BranchID         string  `json:"branch_id" binding:"required"`
	RecipeID         string  `json:"recipe_id" binding:"required"`
	QuantityProduced float64 `json:"quantity_produced" binding:"required"`
	ProductionDate   string  `json:"production_date"`
	BatchNumber      string  `json:"batch_number"`
	ExpiryDate       string  `json:"expiry_date"`
	Notes            string  `json:"notes"`
}

type UpdateBatchRequest struct {
	ProductionDate string `json:"production_date"`
	Notes          string `json:"notes"`
}

type UpdateIngredientRequest struct {
	ActualQuantity  float64 `json:"actual_quantity" binding:"required"`
	WastageQuantity float64 `json:"wastage_quantity"`
}

type UpdatePackagingRequest struct {
	ActualQuantity float64 `json:"actual_quantity" binding:"required"`
}

type ProduceBatchRequest struct {
	ProducedQuantity      float64 `json:"produced_quantity"`
	ProducedQuantityCamel float64 `json:"producedQuantity"`
	Quantity              float64 `json:"quantity"`
	ActualQuantity        float64 `json:"actual_quantity"`
	ProductionDate        string  `json:"production_date"`
	Notes                 string  `json:"notes"`
}

type WastageBatchRequest struct {
	WastageQuantity      float64 `json:"wastage_quantity"`
	WastageQuantityCamel float64 `json:"wastageQuantity"`
	Quantity             float64 `json:"quantity"`
	WastageReason        string  `json:"wastage_reason"`
	WastageReasonCamel   string  `json:"wastageReason"`
}

type CompleteBatchRequest struct {
	ProducedQuantity float64 `json:"produced_quantity"`
	ProductionDate   string  `json:"production_date"`
	BatchNumber      string  `json:"batch_number"`
	ExpiryDate       string  `json:"expiry_date"`
	WastageQuantity  float64 `json:"wastage_quantity"`
	WastageReason    string  `json:"wastage_reason"`
	Notes            string  `json:"notes"`
}

type CancelBatchRequest struct {
	Reason string `json:"reason" binding:"required"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type PaginatedBatchResponse struct {
	Items      []ProductionBatchResponse `json:"items"`
	Pagination PaginationResponse        `json:"pagination"`
}

type ProductionBatchResponse struct {
	ID                    string                         `json:"id"`
	BusinessID            string                         `json:"business_id"`
	BranchID              string                         `json:"branch_id"`
	BranchName            string                         `json:"branch_name"`
	RecipeID              string                         `json:"recipe_id"`
	RecipeName            string                         `json:"recipe_name"`
	ProductID             string                         `json:"product_id"`
	ProductName           string                         `json:"product_name"`
	ProductVariantID      *string                        `json:"product_variant_id"`
	ProductVariantName    string                         `json:"product_variant_name"`
	ProductionBatchNumber string                         `json:"production_batch_number"`
	PlannedQuantity       float64                        `json:"planned_quantity"`
	ProducedQuantity      float64                        `json:"produced_quantity"`
	YieldUnitID           string                         `json:"yield_unit_id"`
	YieldUnitSymbol       string                         `json:"yield_unit_symbol"`
	Status                string                         `json:"status"`
	ProductionDate        time.Time                      `json:"production_date"`
	StartedAt             *time.Time                     `json:"started_at"`
	CompletedAt           *time.Time                     `json:"completed_at"`
	CancelledAt           *time.Time                     `json:"cancelled_at"`
	IngredientCost        float64                        `json:"ingredient_cost"`
	PackagingCost         float64                        `json:"packaging_cost"`
	TotalProductionCost   float64                        `json:"total_production_cost"`
	CostPerUnit           float64                        `json:"cost_per_unit"`
	WastageQuantity       float64                        `json:"wastage_quantity"`
	WastageReason         string                         `json:"wastage_reason"`
	Notes                 string                         `json:"notes"`
	CreatedByUserID       string                         `json:"created_by_user_id"`
	CreatedByUserName     string                         `json:"created_by_user_name"`
	CompletedByUserID     *string                        `json:"completed_by_user_id"`
	Ingredients           []ProductionIngredientResponse `json:"ingredients,omitempty"`
	Packaging             []ProductionPackagingResponse  `json:"packaging,omitempty"`
	Output                *ProductionOutputResponse      `json:"output,omitempty"`
	StockMovementIDs      []string                       `json:"stock_movement_ids,omitempty"`
	CreatedAt             time.Time                      `json:"created_at"`
	UpdatedAt             time.Time                      `json:"updated_at"`
}

type ProductionIngredientResponse struct {
	ID                 string    `json:"id"`
	ComponentProductID *string   `json:"component_product_id"`
	ComponentVariantID *string   `json:"component_variant_id"`
	InventoryItemID    string    `json:"inventory_item_id"`
	RecipeIngredientID string    `json:"recipe_ingredient_id"`
	ItemNameSnapshot   string    `json:"item_name_snapshot"`
	PlannedQuantity    float64   `json:"planned_quantity"`
	RequiredQuantity   float64   `json:"required_quantity"`
	ActualQuantity     float64   `json:"actual_quantity"`
	ConsumedQuantity   float64   `json:"consumed_quantity"`
	UnitID             string    `json:"unit_id"`
	UnitSymbol         string    `json:"unit_symbol"`
	UnitCostSnapshot   float64   `json:"unit_cost_snapshot"`
	TotalCost          float64   `json:"total_cost"`
	WastageQuantity    float64   `json:"wastage_quantity"`
	StockMovementID    *string   `json:"stock_movement_id"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type ProductionPackagingResponse struct {
	ID                    string    `json:"id"`
	ComponentProductID    *string   `json:"component_product_id"`
	ComponentVariantID    *string   `json:"component_variant_id"`
	InventoryItemID       *string   `json:"inventory_item_id"`
	PackagingItemID       *string   `json:"packaging_item_id"`
	RecipePackagingID     string    `json:"recipe_packaging_id"`
	PackagingNameSnapshot string    `json:"packaging_name_snapshot"`
	PlannedQuantity       float64   `json:"planned_quantity"`
	RequiredQuantity      float64   `json:"required_quantity"`
	ActualQuantity        float64   `json:"actual_quantity"`
	ConsumedQuantity      float64   `json:"consumed_quantity"`
	UnitID                string    `json:"unit_id"`
	UnitSymbol            string    `json:"unit_symbol"`
	UnitCostSnapshot      float64   `json:"unit_cost_snapshot"`
	TotalCost             float64   `json:"total_cost"`
	IsOptional            bool      `json:"is_optional"`
	StockMovementID       *string   `json:"stock_movement_id"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type ProductionOutputResponse struct {
	ID                 string     `json:"id"`
	ProductID          string     `json:"product_id"`
	ProductVariantID   *string    `json:"product_variant_id"`
	ProductVariantName string     `json:"product_variant_name"`
	InventoryItemID    string     `json:"inventory_item_id"`
	ProducedQuantity   float64    `json:"produced_quantity"`
	UnitID             string     `json:"unit_id"`
	UnitSymbol         string     `json:"unit_symbol"`
	BatchNumber        string     `json:"batch_number"`
	ExpiryDate         *time.Time `json:"expiry_date"`
	StockMovementID    *string    `json:"stock_movement_id"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type ProductionOutputsResponse struct {
	BatchID            string                    `json:"batch_id"`
	Status             string                    `json:"status"`
	ProductID          string                    `json:"product_id"`
	ProductName        string                    `json:"product_name"`
	ProductVariantID   *string                   `json:"product_variant_id"`
	ProductVariantName string                    `json:"product_variant_name"`
	PlannedQuantity    float64                   `json:"planned_quantity"`
	ProducedQuantity   float64                   `json:"produced_quantity"`
	YieldUnitID        string                    `json:"yield_unit_id"`
	YieldUnitSymbol    string                    `json:"yield_unit_symbol"`
	Output             *ProductionOutputResponse `json:"output"`
}

type ProductionWastageResponse struct {
	BatchID                  string                         `json:"batch_id"`
	Status                   string                         `json:"status"`
	WastageQuantity          float64                        `json:"wastage_quantity"`
	WastageReason            string                         `json:"wastage_reason"`
	IngredientWastageTotal   float64                        `json:"ingredient_wastage_total"`
	IngredientWastageDetails []ProductionIngredientResponse `json:"ingredient_wastage_details"`
}

type ManufacturingSummaryResponse struct {
	TotalBatches          int64   `json:"total_batches"`
	CompletedBatches      int64   `json:"completed_batches"`
	InProgressBatches     int64   `json:"in_progress_batches"`
	CancelledBatches      int64   `json:"cancelled_batches"`
	TotalProducedQuantity float64 `json:"total_produced_quantity"`
	TotalProductionCost   float64 `json:"total_production_cost"`
	TotalWastageQuantity  float64 `json:"total_wastage_quantity"`
}

type ProductionResponse struct {
	ProductionID       string                         `json:"production_id"`
	ProductionNumber   string                         `json:"production_number"`
	Status             string                         `json:"status"`
	BranchID           string                         `json:"branch_id"`
	BranchName         string                         `json:"branch_name"`
	RecipeID           string                         `json:"recipe_id"`
	RecipeName         string                         `json:"recipe_name"`
	ProductID          string                         `json:"product_id"`
	ProductName        string                         `json:"product_name"`
	ProductVariantID   *string                        `json:"product_variant_id"`
	ProductVariantName string                         `json:"product_variant_name"`
	ProducedQuantity   float64                        `json:"produced_quantity"`
	ProductionDate     time.Time                      `json:"production_date"`
	TotalCost          float64                        `json:"total_cost"`
	CostPerUnit        float64                        `json:"cost_per_unit"`
	ConsumedComponents []ProductionIngredientResponse `json:"consumed_components"`
	ConsumedPackaging  []ProductionPackagingResponse  `json:"consumed_packaging"`
	Outputs            []ProductionOutputResponse     `json:"outputs"`
	StockMovementIDs   []string                       `json:"stock_movement_ids"`
	JournalEntryIDs    []string                       `json:"journal_entry_ids"`
}

type ProductionPreviewResponse struct {
	RecipeID                 string                      `json:"recipe_id"`
	RecipeName               string                      `json:"recipe_name"`
	RecipeYieldQuantity      float64                     `json:"recipe_yield_quantity"`
	RecipeYieldUnitID        string                      `json:"recipe_yield_unit_id"`
	RecipeYieldUnit          string                      `json:"recipe_yield_unit"`
	OutputProductID          string                      `json:"output_product_id"`
	OutputProductName        string                      `json:"output_product_name"`
	OutputProductVariantID   *string                     `json:"output_product_variant_id"`
	OutputProductVariantName string                      `json:"output_product_variant_name"`
	QuantityProduced         float64                     `json:"quantity_produced"`
	Components               []ProductionPreviewLineItem `json:"components"`
	Packaging                []ProductionPreviewLineItem `json:"packaging"`
	EstimatedComponentCost   float64                     `json:"estimated_component_cost"`
	EstimatedPackagingCost   float64                     `json:"estimated_packaging_cost"`
	EstimatedTotalCost       float64                     `json:"estimated_total_cost"`
	EstimatedCostPerUnit     float64                     `json:"estimated_cost_per_unit"`
	HasShortage              bool                        `json:"has_shortage"`
	Shortages                []ProductionPreviewShortage `json:"shortages"`
	HasZeroCostWarning       bool                        `json:"has_zero_cost_warning"`
	Warnings                 []string                    `json:"warnings"`
}

type ProductionPreviewLineItem struct {
	RecipeLineID       string  `json:"recipe_line_id"`
	ComponentProductID *string `json:"component_product_id"`
	ComponentVariantID *string `json:"component_variant_id"`
	ProductName        string  `json:"product_name"`
	ProductType        string  `json:"product_type"`
	RequiredQuantity   float64 `json:"required_quantity"`
	AvailableQuantity  float64 `json:"available_quantity"`
	ShortageQuantity   float64 `json:"shortage_quantity"`
	UnitID             string  `json:"unit_id"`
	Unit               string  `json:"unit"`
	EstimatedUnitCost  float64 `json:"estimated_unit_cost"`
	EstimatedTotalCost float64 `json:"estimated_total_cost"`
	IsOptional         bool    `json:"is_optional"`
}

type ProductionPreviewShortage struct {
	RecipeLineID      string  `json:"recipe_line_id"`
	ProductName       string  `json:"product_name"`
	RequiredQuantity  float64 `json:"required_quantity"`
	AvailableQuantity float64 `json:"available_quantity"`
	ShortageQuantity  float64 `json:"shortage_quantity"`
	Unit              string  `json:"unit"`
}

type ProductHistoryResponse struct {
	ProductID         string                    `json:"product_id"`
	ProductName       string                    `json:"product_name"`
	TotalProduced     float64                   `json:"total_produced_quantity"`
	TotalCost         float64                   `json:"total_production_cost"`
	ProductionBatches []ProductionBatchResponse `json:"production_batches"`
}

func (r ProduceBatchRequest) QuantityValue() float64 {
	if r.ProducedQuantity > 0 {
		return r.ProducedQuantity
	}
	if r.ProducedQuantityCamel > 0 {
		return r.ProducedQuantityCamel
	}
	if r.Quantity > 0 {
		return r.Quantity
	}
	return r.ActualQuantity
}

func (r WastageBatchRequest) QuantityValue() float64 {
	if r.WastageQuantity > 0 {
		return r.WastageQuantity
	}
	if r.WastageQuantityCamel > 0 {
		return r.WastageQuantityCamel
	}
	return r.Quantity
}

func (r WastageBatchRequest) ReasonValue() string {
	if r.WastageReason != "" {
		return r.WastageReason
	}
	return r.WastageReasonCamel
}
