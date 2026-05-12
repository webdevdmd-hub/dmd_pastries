package ingredients

import "time"

type ListQuery struct {
	Search               string
	IngredientCategoryID string
	SupplierID           string
	Status               string
	IsStockTracked       *bool
	IsExpiryTracked      *bool
	Page                 int
	Limit                int
	SortBy               string
	SortOrder            string
}

type LookupQuery struct {
	Search string
	Limit  int
}

type CreateIngredientRequest struct {
	IngredientName       string  `json:"ingredient_name" binding:"required"`
	IngredientCategoryID string  `json:"ingredient_category_id" binding:"required"`
	SupplierID           string  `json:"supplier_id"`
	UnitID               string  `json:"unit_id" binding:"required"`
	CostPerUnit          float64 `json:"cost_per_unit"`
	IsStockTracked       bool    `json:"is_stock_tracked"`
	IsExpiryTracked      bool    `json:"is_expiry_tracked"`
	ReorderLevel         float64 `json:"reorder_level"`
	Description          string  `json:"description"`
	ImageURL             string  `json:"image_url"`
	ImageFileID          string  `json:"image_file_id"`
}

type UpdateIngredientRequest struct {
	IngredientName       string   `json:"ingredient_name"`
	IngredientCategoryID string   `json:"ingredient_category_id"`
	SupplierID           *string  `json:"supplier_id"`
	UnitID               string   `json:"unit_id"`
	CostPerUnit          *float64 `json:"cost_per_unit"`
	IsStockTracked       *bool    `json:"is_stock_tracked"`
	IsExpiryTracked      *bool    `json:"is_expiry_tracked"`
	ReorderLevel         *float64 `json:"reorder_level"`
	Description          string   `json:"description"`
	ImageURL             *string  `json:"image_url"`
	ImageFileID          string   `json:"image_file_id"`
	Status               string   `json:"status"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type IngredientResponse struct {
	ID                   string    `json:"id"`
	BusinessID           string    `json:"business_id"`
	BranchID             string    `json:"branch_id"`
	IngredientCategoryID string    `json:"ingredient_category_id"`
	CategoryName         string    `json:"category_name"`
	SupplierID           *string   `json:"supplier_id"`
	SupplierName         string    `json:"supplier_name"`
	IngredientName       string    `json:"ingredient_name"`
	IngredientCode       string    `json:"ingredient_code"`
	Description          string    `json:"description"`
	UnitID               string    `json:"unit_id"`
	UnitName             string    `json:"unit_name"`
	UnitSymbol           string    `json:"unit_symbol"`
	CostPerUnit          float64   `json:"cost_per_unit"`
	IsStockTracked       bool      `json:"is_stock_tracked"`
	IsExpiryTracked      bool      `json:"is_expiry_tracked"`
	ReorderLevel         float64   `json:"reorder_level"`
	ImageURL             *string   `json:"image_url"`
	ImageFileID          string    `json:"image_file_id"`
	Status               string    `json:"status"`
	InventoryItemID      *string   `json:"inventory_item_id,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type IngredientLookupItem struct {
	ID              string  `json:"id"`
	IngredientName  string  `json:"ingredient_name"`
	IngredientCode  string  `json:"ingredient_code"`
	UnitID          string  `json:"unit_id"`
	UnitSymbol      string  `json:"unit_symbol"`
	CostPerUnit     float64 `json:"cost_per_unit"`
	IsStockTracked  bool    `json:"is_stock_tracked"`
	IsExpiryTracked bool    `json:"is_expiry_tracked"`
	Status          string  `json:"status"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type ListResponse struct {
	Items      []IngredientResponse `json:"items"`
	Pagination PaginationResponse   `json:"pagination"`
}

type LookupResponse struct {
	Items []IngredientLookupItem `json:"items"`
}
