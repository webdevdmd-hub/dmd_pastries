package recipes

import "time"

type ListQuery struct {
	Search    string
	ProductID string
	Status    string
	IsActive  *bool
	Page      int
	Limit     int
	SortBy    string
	SortOrder string
}

type CreateRecipeRequest struct {
	ProductID              string                  `json:"product_id" binding:"required"`
	ProductVariantID       string                  `json:"product_variant_id"`
	NewProductVariant      *RecipeVariantInput     `json:"new_product_variant"`
	RecipeName             string                  `json:"recipe_name" binding:"required"`
	Description            string                  `json:"description"`
	BatchYieldQuantity     float64                 `json:"batch_yield_quantity" binding:"required"`
	BatchYieldUnitID       string                  `json:"batch_yield_unit_id" binding:"required"`
	PreparationTimeMinutes *int                    `json:"preparation_time_minutes"`
	Instructions           string                  `json:"instructions"`
	Status                 string                  `json:"status"`
	Ingredients            []RecipeIngredientInput `json:"ingredients"`
	Packaging              []RecipePackagingInput  `json:"packaging"`
}

type UpdateRecipeRequest struct {
	RecipeName             string              `json:"recipe_name"`
	ProductVariantID       *string             `json:"product_variant_id"`
	NewProductVariant      *RecipeVariantInput `json:"new_product_variant"`
	Description            string              `json:"description"`
	BatchYieldQuantity     *float64            `json:"batch_yield_quantity"`
	BatchYieldUnitID       string              `json:"batch_yield_unit_id"`
	PreparationTimeMinutes *int                `json:"preparation_time_minutes"`
	Instructions           string              `json:"instructions"`
	Status                 string              `json:"status"`
}

type RecipeVariantInput struct {
	VariantName string   `json:"variant_name"`
	SKU         string   `json:"sku"`
	Barcode     string   `json:"barcode"`
	SalePrice   *float64 `json:"sale_price"`
	CostPrice   *float64 `json:"cost_price"`
	ImageFileID string   `json:"image_file_id"`
	SortOrder   int      `json:"sort_order"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type RecipeIngredientInput struct {
	ComponentProductID string  `json:"component_product_id"`
	ComponentVariantID string  `json:"component_variant_id"`
	IngredientID       string  `json:"ingredient_id"`
	InventoryItemID    string  `json:"inventory_item_id"`
	QuantityRequired   float64 `json:"quantity_required" binding:"required"`
	UnitID             string  `json:"unit_id" binding:"required"`
	WastagePercentage  float64 `json:"wastage_percentage"`
	SortOrder          int     `json:"sort_order"`
	Notes              string  `json:"notes"`
}

type RecipePackagingInput struct {
	ComponentProductID string  `json:"component_product_id"`
	ComponentVariantID string  `json:"component_variant_id"`
	PackagingItemID    string  `json:"packaging_item_id"`
	QuantityRequired   float64 `json:"quantity_required" binding:"required"`
	UnitID             string  `json:"unit_id" binding:"required"`
	IsOptional         bool    `json:"is_optional"`
	SortOrder          int     `json:"sort_order"`
}

type CreateVersionRequest struct {
	ChangeNote string `json:"change_note"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type ListResponse struct {
	Items      []RecipeResponse   `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type RecipeResponse struct {
	ID                      string                     `json:"id"`
	BusinessID              string                     `json:"business_id"`
	BranchID                string                     `json:"branch_id"`
	ProductID               string                     `json:"product_id"`
	ProductName             string                     `json:"product_name"`
	ProductType             string                     `json:"product_type"`
	ProductVariantID        *string                    `json:"product_variant_id"`
	ProductVariantName      string                     `json:"product_variant_name"`
	RecipeCode              string                     `json:"recipe_code"`
	RecipeName              string                     `json:"recipe_name"`
	Description             string                     `json:"description"`
	BatchYieldQuantity      float64                    `json:"batch_yield_quantity"`
	BatchYieldUnitID        string                     `json:"batch_yield_unit_id"`
	BatchYieldUnitSymbol    string                     `json:"batch_yield_unit_symbol"`
	PreparationTimeMinutes  *int                       `json:"preparation_time_minutes"`
	Instructions            string                     `json:"instructions"`
	EstimatedIngredientCost float64                    `json:"estimated_ingredient_cost"`
	EstimatedPackagingCost  float64                    `json:"estimated_packaging_cost"`
	EstimatedTotalCost      float64                    `json:"estimated_total_cost"`
	CostPerYieldUnit        float64                    `json:"cost_per_yield_unit"`
	VersionNumber           int                        `json:"version_number"`
	IsActive                bool                       `json:"is_active"`
	Status                  string                     `json:"status"`
	Ingredients             []RecipeIngredientResponse `json:"ingredients,omitempty"`
	Packaging               []RecipePackagingResponse  `json:"packaging,omitempty"`
	CreatedAt               time.Time                  `json:"created_at"`
	UpdatedAt               time.Time                  `json:"updated_at"`
}

type RecipeIngredientResponse struct {
	ID                 string    `json:"id"`
	ComponentProductID *string   `json:"component_product_id"`
	ComponentVariantID *string   `json:"component_variant_id"`
	IngredientID       *string   `json:"ingredient_id"`
	InventoryItemID    *string   `json:"inventory_item_id"`
	ItemNameSnapshot   string    `json:"item_name_snapshot"`
	QuantityRequired   float64   `json:"quantity_required"`
	UnitID             string    `json:"unit_id"`
	UnitSymbol         string    `json:"unit_symbol"`
	UnitCostSnapshot   float64   `json:"unit_cost_snapshot"`
	TotalCost          float64   `json:"total_cost"`
	WastagePercentage  float64   `json:"wastage_percentage"`
	SortOrder          int       `json:"sort_order"`
	Notes              string    `json:"notes"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type RecipePackagingResponse struct {
	ID                    string    `json:"id"`
	ComponentProductID    *string   `json:"component_product_id"`
	ComponentVariantID    *string   `json:"component_variant_id"`
	PackagingItemID       *string   `json:"packaging_item_id"`
	PackagingNameSnapshot string    `json:"packaging_name_snapshot"`
	QuantityRequired      float64   `json:"quantity_required"`
	UnitID                string    `json:"unit_id"`
	UnitSymbol            string    `json:"unit_symbol"`
	UnitCostSnapshot      float64   `json:"unit_cost_snapshot"`
	TotalCost             float64   `json:"total_cost"`
	IsOptional            bool      `json:"is_optional"`
	SortOrder             int       `json:"sort_order"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type CostResponse struct {
	EstimatedIngredientCost float64                    `json:"estimated_ingredient_cost"`
	EstimatedPackagingCost  float64                    `json:"estimated_packaging_cost"`
	EstimatedTotalCost      float64                    `json:"estimated_total_cost"`
	BatchYieldQuantity      float64                    `json:"batch_yield_quantity"`
	CostPerYieldUnit        float64                    `json:"cost_per_yield_unit"`
	Ingredients             []RecipeIngredientResponse `json:"ingredients"`
	Packaging               []RecipePackagingResponse  `json:"packaging"`
}

type VersionResponse struct {
	ID              string    `json:"id"`
	RecipeID        string    `json:"recipe_id"`
	VersionNumber   int       `json:"version_number"`
	ChangeNote      string    `json:"change_note"`
	SnapshotJSON    string    `json:"snapshot_json"`
	CreatedByUserID string    `json:"created_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
}

type LookupResponse struct {
	Items []RecipeLookupItem `json:"items"`
}

type RecipeLookupItem struct {
	ID                 string  `json:"id"`
	RecipeCode         string  `json:"recipe_code"`
	RecipeName         string  `json:"recipe_name"`
	ProductID          string  `json:"product_id"`
	ProductName        string  `json:"product_name"`
	ProductVariantID   *string `json:"product_variant_id"`
	ProductVariantName string  `json:"product_variant_name"`
	Status             string  `json:"status"`
	IsActive           bool    `json:"is_active"`
}
