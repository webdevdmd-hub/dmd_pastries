package productvariants

import "time"

type CreateVariantRequest struct {
	VariantName string   `json:"variant_name" binding:"required"`
	SKU         string   `json:"sku"`
	Barcode     string   `json:"barcode"`
	SalePrice   float64  `json:"sale_price"`
	CostPrice   *float64 `json:"cost_price"`
	ImageFileID string   `json:"image_file_id"`
	SortOrder   int      `json:"sort_order"`
}

type UpdateVariantRequest struct {
	VariantName string   `json:"variant_name"`
	SKU         string   `json:"sku"`
	Barcode     string   `json:"barcode"`
	SalePrice   *float64 `json:"sale_price"`
	CostPrice   *float64 `json:"cost_price"`
	ImageFileID string   `json:"image_file_id"`
	SortOrder   *int     `json:"sort_order"`
}

type UpdateVariantStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type VariantResponse struct {
	ID          string    `json:"id"`
	BusinessID  string    `json:"business_id"`
	ProductID   string    `json:"product_id"`
	VariantName string    `json:"variant_name"`
	SKU         string    `json:"sku"`
	Barcode     string    `json:"barcode"`
	SalePrice   float64   `json:"sale_price"`
	CostPrice   *float64  `json:"cost_price"`
	ImageFileID string    `json:"image_file_id"`
	SortOrder   int       `json:"sort_order"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
