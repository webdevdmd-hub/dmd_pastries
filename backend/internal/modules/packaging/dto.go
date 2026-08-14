package packaging

import (
	"time"

	"pastries-pos/internal/shared/money"
)

type ListQuery struct {
	Search              string
	PackagingCategoryID string
	SupplierID          string
	Status              string
	IsStockTracked      *bool
	Page                int
	Limit               int
	SortBy              string
	SortOrder           string
}

type LookupQuery struct {
	Search string
	Limit  int
}

type CreatePackagingRequest struct {
	PackagingName       string       `json:"packaging_name" binding:"required"`
	PackagingCategoryID string       `json:"packaging_category_id" binding:"required"`
	SupplierID          string       `json:"supplier_id"`
	UnitID              string       `json:"unit_id" binding:"required"`
	CostPerUnit         money.Amount `json:"cost_per_unit"`
	IsStockTracked      bool         `json:"is_stock_tracked"`
	IsConsumable        bool         `json:"is_consumable"`
	ReorderLevel        money.Amount `json:"reorder_level"`
	Description         string       `json:"description"`
	ImageURL            string       `json:"image_url"`
	ImageFileID         string       `json:"image_file_id"`
}

type UpdatePackagingRequest struct {
	PackagingName       string        `json:"packaging_name"`
	PackagingCategoryID string        `json:"packaging_category_id"`
	SupplierID          *string       `json:"supplier_id"`
	UnitID              string        `json:"unit_id"`
	CostPerUnit         *money.Amount `json:"cost_per_unit"`
	IsStockTracked      *bool         `json:"is_stock_tracked"`
	IsConsumable        *bool         `json:"is_consumable"`
	ReorderLevel        *money.Amount `json:"reorder_level"`
	Description         string        `json:"description"`
	ImageURL            *string       `json:"image_url"`
	ImageFileID         string        `json:"image_file_id"`
	Status              string        `json:"status"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type CreateUsageRuleRequest struct {
	PackagingItemID  string       `json:"packaging_item_id" binding:"required"`
	QuantityRequired money.Amount `json:"quantity_required"`
	IsDefault        bool         `json:"is_default"`
}

type PackagingResponse struct {
	ID                  string       `json:"id"`
	BusinessID          string       `json:"business_id"`
	BranchID            string       `json:"branch_id"`
	PackagingCategoryID string       `json:"packaging_category_id"`
	CategoryName        string       `json:"category_name"`
	SupplierID          *string      `json:"supplier_id"`
	SupplierName        string       `json:"supplier_name"`
	PackagingName       string       `json:"packaging_name"`
	PackagingCode       string       `json:"packaging_code"`
	Description         string       `json:"description"`
	UnitID              string       `json:"unit_id"`
	UnitName            string       `json:"unit_name"`
	UnitSymbol          string       `json:"unit_symbol"`
	CostPerUnit         money.Amount `json:"cost_per_unit"`
	IsStockTracked      bool         `json:"is_stock_tracked"`
	IsConsumable        bool         `json:"is_consumable"`
	ReorderLevel        money.Amount `json:"reorder_level"`
	ImageURL            *string      `json:"image_url"`
	ImageFileID         string       `json:"image_file_id"`
	Status              string       `json:"status"`
	InventoryItemID     *string      `json:"inventory_item_id,omitempty"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
}

type PackagingLookupItem struct {
	ID             string       `json:"id"`
	PackagingName  string       `json:"packaging_name"`
	PackagingCode  string       `json:"packaging_code"`
	UnitID         string       `json:"unit_id"`
	UnitSymbol     string       `json:"unit_symbol"`
	CostPerUnit    money.Amount `json:"cost_per_unit"`
	IsStockTracked bool         `json:"is_stock_tracked"`
	Status         string       `json:"status"`
}

type UsageRuleResponse struct {
	ID               string       `json:"id"`
	BusinessID       string       `json:"business_id"`
	ProductID        string       `json:"product_id"`
	ProductName      string       `json:"product_name"`
	PackagingItemID  string       `json:"packaging_item_id"`
	PackagingName    string       `json:"packaging_name"`
	PackagingCode    string       `json:"packaging_code"`
	QuantityRequired money.Amount `json:"quantity_required"`
	IsDefault        bool         `json:"is_default"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type ListResponse struct {
	Items      []PackagingResponse `json:"items"`
	Pagination PaginationResponse  `json:"pagination"`
}

type LookupResponse struct {
	Items []PackagingLookupItem `json:"items"`
}
