package productvariants

import "time"

type CreateVariantRequest struct {
	VariantName            string   `json:"variant_name" binding:"required"`
	SKU                    string   `json:"sku"`
	Barcode                string   `json:"barcode"`
	SalePrice              float64  `json:"sale_price"`
	CostPrice              *float64 `json:"cost_price"`
	CostUpdatePolicy       string   `json:"cost_update_policy"`
	PricingType            string   `json:"pricing_type"`
	PricingPercent         float64  `json:"pricing_percent"`
	MinimumSalePrice       *float64 `json:"minimum_sale_price"`
	AutoPriceUpdateEnabled bool     `json:"auto_price_update_enabled"`
	SalePriceLocked        bool     `json:"sale_price_locked"`
	ImageFileID            string   `json:"image_file_id"`
	SortOrder              int      `json:"sort_order"`
}

type UpdateVariantRequest struct {
	VariantName            string   `json:"variant_name"`
	SKU                    string   `json:"sku"`
	Barcode                string   `json:"barcode"`
	SalePrice              *float64 `json:"sale_price"`
	CostPrice              *float64 `json:"cost_price"`
	CostUpdatePolicy       *string  `json:"cost_update_policy"`
	PricingType            *string  `json:"pricing_type"`
	PricingPercent         *float64 `json:"pricing_percent"`
	MinimumSalePrice       *float64 `json:"minimum_sale_price"`
	AutoPriceUpdateEnabled *bool    `json:"auto_price_update_enabled"`
	SalePriceLocked        *bool    `json:"sale_price_locked"`
	ImageFileID            string   `json:"image_file_id"`
	SortOrder              *int     `json:"sort_order"`
}

type UpdateVariantStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type VariantResponse struct {
	ID                     string     `json:"id"`
	BusinessID             string     `json:"business_id"`
	ProductID              string     `json:"product_id"`
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
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}
