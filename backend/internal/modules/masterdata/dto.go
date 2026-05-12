package masterdata

import "time"

type CreateProductCategoryRequest struct {
	ParentCategoryID *string `json:"parent_category_id" binding:"omitempty,uuid"`
	CategoryName     string  `json:"category_name" binding:"required"`
	CategoryCode     string  `json:"category_code"`
	Description      string  `json:"description"`
	ImageFileID      string  `json:"image_file_id"`
	SortOrder        int     `json:"sort_order"`
}

type UpdateProductCategoryRequest struct {
	ParentCategoryID *string `json:"parent_category_id" binding:"omitempty,uuid"`
	CategoryName     string  `json:"category_name"`
	CategoryCode     string  `json:"category_code"`
	Description      string  `json:"description"`
	ImageFileID      string  `json:"image_file_id"`
	SortOrder        *int    `json:"sort_order"`
}

type CreateSimpleCategoryRequest struct {
	CategoryName string `json:"category_name" binding:"required"`
	Description  string `json:"description"`
}

type UpdateSimpleCategoryRequest struct {
	CategoryName string `json:"category_name"`
	Description  string `json:"description"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active inactive"`
}

type CopyCategoriesRequest struct {
	CategoryType   string `json:"category_type" binding:"required,oneof=product_categories ingredient_categories packaging_categories supplier_categories"`
	SourceBranchID string `json:"source_branch_id" binding:"required,uuid"`
}

type CopyCategoriesResponse struct {
	CategoryType       string                    `json:"category_type"`
	SourceBranchID     string                    `json:"source_branch_id"`
	TargetBranchID     string                    `json:"target_branch_id"`
	CreatedCount       int                       `json:"created_count"`
	SkippedCount       int                       `json:"skipped_count"`
	CreatedCategoryIDs []string                  `json:"created_category_ids"`
	SkippedCategories  []SkippedCategoryResponse `json:"skipped_categories"`
}

type SkippedCategoryResponse struct {
	CategoryName string `json:"category_name"`
	Reason       string `json:"reason"`
}

type CreateUnitRequest struct {
	UnitCategoryID   string  `json:"unit_category_id" binding:"required,uuid"`
	UnitName         string  `json:"unit_name" binding:"required"`
	Symbol           string  `json:"symbol" binding:"required"`
	BaseUnitID       *string `json:"base_unit_id" binding:"omitempty,uuid"`
	ConversionFactor float64 `json:"conversion_factor"`
	DecimalPrecision int     `json:"decimal_precision"`
}

type UpdateUnitRequest struct {
	UnitCategoryID   string   `json:"unit_category_id" binding:"omitempty,uuid"`
	UnitName         string   `json:"unit_name"`
	Symbol           string   `json:"symbol"`
	BaseUnitID       *string  `json:"base_unit_id" binding:"omitempty,uuid"`
	ConversionFactor *float64 `json:"conversion_factor"`
	DecimalPrecision *int     `json:"decimal_precision"`
}

type UnitCategoryResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UnitResponse struct {
	ID               string               `json:"id"`
	BusinessID       *string              `json:"business_id"`
	UnitCategoryID   string               `json:"unit_category_id"`
	UnitCategory     UnitCategoryResponse `json:"unit_category"`
	UnitName         string               `json:"unit_name"`
	Symbol           string               `json:"symbol"`
	BaseUnitID       *string              `json:"base_unit_id"`
	ConversionFactor float64              `json:"conversion_factor"`
	DecimalPrecision int                  `json:"decimal_precision"`
	IsSystemDefault  bool                 `json:"is_system_default"`
	Status           string               `json:"status"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        time.Time            `json:"updated_at"`
}

type CreateOrderStatusRequest struct {
	StatusName    string `json:"status_name" binding:"required"`
	StatusKey     string `json:"status_key"`
	SortOrder     int    `json:"sort_order"`
	Color         string `json:"color"`
	IsFinalStatus bool   `json:"is_final_status"`
}

type UpdateOrderStatusRequest struct {
	StatusName    string `json:"status_name"`
	StatusKey     string `json:"status_key"`
	SortOrder     *int   `json:"sort_order"`
	Color         string `json:"color"`
	IsFinalStatus *bool  `json:"is_final_status"`
}

type CreatePaymentStatusRequest struct {
	StatusName string `json:"status_name" binding:"required"`
	StatusKey  string `json:"status_key"`
	Color      string `json:"color"`
}

type UpdatePaymentStatusRequest struct {
	StatusName string `json:"status_name"`
	StatusKey  string `json:"status_key"`
	Color      string `json:"color"`
}

type OrderStatusResponse struct {
	ID              string    `json:"id"`
	BusinessID      *string   `json:"business_id"`
	StatusName      string    `json:"status_name"`
	StatusKey       string    `json:"status_key"`
	SortOrder       int       `json:"sort_order"`
	Color           string    `json:"color"`
	IsSystemDefault bool      `json:"is_system_default"`
	IsFinalStatus   bool      `json:"is_final_status"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type PaymentStatusResponse struct {
	ID              string    `json:"id"`
	BusinessID      *string   `json:"business_id"`
	StatusName      string    `json:"status_name"`
	StatusKey       string    `json:"status_key"`
	Color           string    `json:"color"`
	IsSystemDefault bool      `json:"is_system_default"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ProductCategoryResponse struct {
	ID               string    `json:"id"`
	BusinessID       string    `json:"business_id"`
	BranchID         string    `json:"branch_id"`
	ParentCategoryID *string   `json:"parent_category_id"`
	CategoryName     string    `json:"category_name"`
	CategoryCode     string    `json:"category_code"`
	Description      string    `json:"description"`
	ImageFileID      string    `json:"image_file_id"`
	SortOrder        int       `json:"sort_order"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type SimpleCategoryResponse struct {
	ID           string    `json:"id"`
	BusinessID   string    `json:"business_id"`
	BranchID     string    `json:"branch_id"`
	CategoryName string    `json:"category_name"`
	Description  string    `json:"description"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type OverviewResponse struct {
	UnitsCount                int64 `json:"units_count"`
	ProductCategoriesCount    int64 `json:"product_categories_count"`
	IngredientCategoriesCount int64 `json:"ingredient_categories_count"`
	PackagingCategoriesCount  int64 `json:"packaging_categories_count"`
	SupplierCategoriesCount   int64 `json:"supplier_categories_count"`
	OrderStatusesCount        int64 `json:"order_statuses_count"`
	PaymentStatusesCount      int64 `json:"payment_statuses_count"`
}
