package products

import "time"

type CreateProductRequest struct {
	ProductName            string   `json:"product_name" binding:"required"`
	ProductCode            string   `json:"product_code"`
	CategoryID             string   `json:"category_id" binding:"required,uuid"`
	UnitID                 string   `json:"unit_id" binding:"required,uuid"`
	TaxRateID              *string  `json:"tax_rate_id" binding:"omitempty,uuid"`
	ProductType            string   `json:"product_type" binding:"required"`
	ItemStructure          string   `json:"item_structure"`
	SalePrice              float64  `json:"sale_price"`
	CostPrice              *float64 `json:"cost_price"`
	CompareAtPrice         *float64 `json:"compare_at_price"`
	CostUpdatePolicy       string   `json:"cost_update_policy"`
	PricingType            string   `json:"pricing_type"`
	PricingPercent         float64  `json:"pricing_percent"`
	MinimumSalePrice       *float64 `json:"minimum_sale_price"`
	AutoPriceUpdateEnabled bool     `json:"auto_price_update_enabled"`
	SalePriceLocked        bool     `json:"sale_price_locked"`
	SKU                    string   `json:"sku"`
	Barcode                string   `json:"barcode"`
	Description            string   `json:"description"`
	ImageFileID            string   `json:"image_file_id"`
	IsSellable             *bool    `json:"is_sellable"`
	IsPOSVisible           *bool    `json:"is_pos_visible"`
	IsPurchasable          *bool    `json:"is_purchasable"`
	IsStockTracked         bool     `json:"is_stock_tracked"`
	IsExpiryTracked        bool     `json:"is_expiry_tracked"`
	IsCustomOrderAvailable bool     `json:"is_custom_order_available"`
	PreparationTimeMinutes *int     `json:"preparation_time_minutes"`
}

type UpdateProductRequest struct {
	ProductName            string   `json:"product_name"`
	CategoryID             string   `json:"category_id" binding:"omitempty,uuid"`
	UnitID                 string   `json:"unit_id" binding:"omitempty,uuid"`
	TaxRateID              *string  `json:"tax_rate_id" binding:"omitempty,uuid"`
	Description            string   `json:"description"`
	ProductType            string   `json:"product_type"`
	ItemStructure          string   `json:"item_structure"`
	SalePrice              *float64 `json:"sale_price"`
	CostPrice              *float64 `json:"cost_price"`
	CompareAtPrice         *float64 `json:"compare_at_price"`
	CostUpdatePolicy       *string  `json:"cost_update_policy"`
	PricingType            *string  `json:"pricing_type"`
	PricingPercent         *float64 `json:"pricing_percent"`
	MinimumSalePrice       *float64 `json:"minimum_sale_price"`
	AutoPriceUpdateEnabled *bool    `json:"auto_price_update_enabled"`
	SalePriceLocked        *bool    `json:"sale_price_locked"`
	SKU                    string   `json:"sku"`
	Barcode                string   `json:"barcode"`
	ImageFileID            string   `json:"image_file_id"`
	IsSellable             *bool    `json:"is_sellable"`
	IsPOSVisible           *bool    `json:"is_pos_visible"`
	IsPurchasable          *bool    `json:"is_purchasable"`
	IsStockTracked         *bool    `json:"is_stock_tracked"`
	IsExpiryTracked        *bool    `json:"is_expiry_tracked"`
	IsCustomOrderAvailable *bool    `json:"is_custom_order_available"`
	PreparationTimeMinutes *int     `json:"preparation_time_minutes"`
	Status                 string   `json:"status"`
}

type UpdateProductStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type ProductListQuery struct {
	Search         string
	CategoryID     string
	ProductType    string
	ItemStructure  string
	Status         string
	IsPOSVisible   *bool
	IsSellable     *bool
	IsPurchasable  *bool
	IsStockTracked *bool
	Page           int
	Limit          int
	SortBy         string
	SortOrder      string
}

type ProductListResponse struct {
	Items      []ProductResponse  `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type ProductResponse struct {
	ID                     string               `json:"id"`
	BusinessID             string               `json:"business_id"`
	BranchID               string               `json:"branch_id"`
	ProductName            string               `json:"product_name"`
	ProductCode            string               `json:"product_code"`
	SKU                    string               `json:"sku"`
	Barcode                string               `json:"barcode"`
	Category               ProductCategoryInfo  `json:"category"`
	Unit                   ProductUnitInfo      `json:"unit"`
	TaxRate                *ProductTaxRateInfo  `json:"tax_rate"`
	ProductType            string               `json:"product_type"`
	ItemStructure          string               `json:"item_structure"`
	SalePrice              float64              `json:"sale_price"`
	CostPrice              *float64             `json:"cost_price"`
	CompareAtPrice         *float64             `json:"compare_at_price"`
	CostUpdatePolicy       string               `json:"cost_update_policy"`
	PricingType            string               `json:"pricing_type"`
	PricingPercent         float64              `json:"pricing_percent"`
	MinimumSalePrice       *float64             `json:"minimum_sale_price"`
	SuggestedSalePrice     *float64             `json:"suggested_sale_price"`
	AutoPriceUpdateEnabled bool                 `json:"auto_price_update_enabled"`
	SalePriceLocked        bool                 `json:"sale_price_locked"`
	LastPurchaseCost       *float64             `json:"last_purchase_cost"`
	LastPurchaseDate       *time.Time           `json:"last_purchase_date"`
	LastProductionCost     *float64             `json:"last_production_cost"`
	LastProductionDate     *time.Time           `json:"last_production_date"`
	AverageInventoryCost   *float64             `json:"average_inventory_cost"`
	Description            string               `json:"description"`
	ImageFileID            string               `json:"image_file_id"`
	IsSellable             bool                 `json:"is_sellable"`
	IsPOSVisible           bool                 `json:"is_pos_visible"`
	IsPurchasable          bool                 `json:"is_purchasable"`
	IsStockTracked         bool                 `json:"is_stock_tracked"`
	IsExpiryTracked        bool                 `json:"is_expiry_tracked"`
	IsCustomOrderAvailable bool                 `json:"is_custom_order_available"`
	PreparationTimeMinutes *int                 `json:"preparation_time_minutes"`
	Status                 string               `json:"status"`
	Variants               []ProductVariantInfo `json:"variants"`
	CreatedAt              time.Time            `json:"created_at"`
	UpdatedAt              time.Time            `json:"updated_at"`
}

type ProductCategoryInfo struct {
	ID           string `json:"id"`
	CategoryName string `json:"category_name"`
	CategoryCode string `json:"category_code"`
}

type ProductUnitInfo struct {
	ID       string `json:"id"`
	UnitName string `json:"unit_name"`
	Symbol   string `json:"symbol"`
}

type ProductTaxRateInfo struct {
	ID             string  `json:"id"`
	TaxName        string  `json:"tax_name"`
	TaxType        string  `json:"tax_type"`
	RatePercentage float64 `json:"rate_percentage"`
	IsInclusive    bool    `json:"is_inclusive"`
	Status         string  `json:"status"`
}

type ProductVariantInfo struct {
	ID                     string     `json:"id"`
	VariantName            string     `json:"variant_name"`
	SKU                    string     `json:"sku"`
	Barcode                string     `json:"barcode"`
	SalePrice              float64    `json:"sale_price"`
	CostPrice              *float64   `json:"cost_price"`
	CostUpdatePolicy       string     `json:"cost_update_policy"`
	PricingType            string     `json:"pricing_type"`
	PricingPercent         float64    `json:"pricing_percent"`
	MinimumSalePrice       *float64   `json:"minimum_sale_price"`
	SuggestedSalePrice     *float64   `json:"suggested_sale_price"`
	AutoPriceUpdateEnabled bool       `json:"auto_price_update_enabled"`
	SalePriceLocked        bool       `json:"sale_price_locked"`
	LastPurchaseCost       *float64   `json:"last_purchase_cost"`
	LastPurchaseDate       *time.Time `json:"last_purchase_date"`
	LastProductionCost     *float64   `json:"last_production_cost"`
	LastProductionDate     *time.Time `json:"last_production_date"`
	AverageInventoryCost   *float64   `json:"average_inventory_cost"`
	ImageFileID            string     `json:"image_file_id"`
	SortOrder              int        `json:"sort_order"`
	Status                 string     `json:"status"`
}

type PriceSuggestionListQuery struct {
	Status   string
	BranchID string
	Page     int
	Limit    int
}

type ProductPriceSuggestionResponse struct {
	ID                 string     `json:"id"`
	BusinessID         string     `json:"business_id"`
	BranchID           string     `json:"branch_id"`
	ProductID          string     `json:"product_id"`
	ProductName        string     `json:"product_name"`
	ProductCode        string     `json:"product_code"`
	ProductVariantID   *string    `json:"product_variant_id"`
	ProductVariantName string     `json:"product_variant_name"`
	CurrentCost        float64    `json:"current_cost"`
	PreviousCost       *float64   `json:"previous_cost"`
	CurrentSalePrice   float64    `json:"current_sale_price"`
	SuggestedSalePrice float64    `json:"suggested_sale_price"`
	PricingType        string     `json:"pricing_type"`
	PricingPercent     float64    `json:"pricing_percent"`
	SourceType         string     `json:"source_type"`
	SourceID           *string    `json:"source_id"`
	SourceNumber       string     `json:"source_number"`
	Reason             string     `json:"reason"`
	Status             string     `json:"status"`
	AppliedAt          *time.Time `json:"applied_at"`
	DismissedAt        *time.Time `json:"dismissed_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type ProductPriceSuggestionListResponse struct {
	Items      []ProductPriceSuggestionResponse `json:"items"`
	Pagination PaginationResponse               `json:"pagination"`
}

type ApplyPriceSuggestionRequest struct {
	SalePrice *float64 `json:"sale_price"`
}

type BulkApplyPriceSuggestionsRequest struct {
	IDs []string `json:"ids"`
}

type ProductLookupResponse struct {
	Product   ProductResponse     `json:"product"`
	Variant   *ProductVariantInfo `json:"variant"`
	MatchedBy string              `json:"matched_by"`
}
