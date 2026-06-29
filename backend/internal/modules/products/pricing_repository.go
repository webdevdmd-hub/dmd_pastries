package products

import (
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type pricingTarget struct {
	ProductID              string
	ProductVariantID       *string
	SalePrice              float64
	CostPrice              *float64
	CostUpdatePolicy       string
	PricingType            string
	PricingPercent         float64
	MinimumSalePrice       *float64
	AutoPriceUpdateEnabled bool
	SalePriceLocked        bool
}

func (r *Repository) PricingTarget(tx *gorm.DB, businessID, branchID, productID string, variantID *string) (pricingTarget, error) {
	if variantID != nil && strings.TrimSpace(*variantID) != "" {
		var row pricingTarget
		err := tx.Table("product_variants pv").
			Select(`p.id AS product_id, pv.id AS product_variant_id, pv.sale_price, pv.cost_price,
				pv.cost_update_policy, pv.pricing_type, pv.pricing_percent, pv.minimum_sale_price,
				pv.auto_price_update_enabled, pv.sale_price_locked`).
			Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id AND p.branch_id = ? AND p.deleted_at IS NULL", branchID).
			Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ? AND pv.deleted_at IS NULL", *variantID, productID, businessID).
			Take(&row).Error
		return row, err
	}
	var row pricingTarget
	err := tx.Table("products").
		Select(`id AS product_id, sale_price, cost_price, cost_update_policy, pricing_type, pricing_percent,
			minimum_sale_price, auto_price_update_enabled, sale_price_locked`).
		Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", productID, businessID, branchID).
		Take(&row).Error
	return row, err
}

func (r *Repository) UpdatePricingTarget(tx *gorm.DB, businessID, branchID, productID string, variantID *string, updates map[string]interface{}) error {
	if variantID != nil && strings.TrimSpace(*variantID) != "" {
		result := tx.Table("product_variants").
			Where("id = ? AND product_id = ? AND business_id = ? AND deleted_at IS NULL", *variantID, productID, businessID).
			Where("product_id IN (SELECT id FROM products WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL)", businessID, branchID).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	}
	return r.Update(tx, productID, businessID, branchID, updates)
}

func (r *Repository) InventoryAverageCost(tx *gorm.DB, businessID, inventoryItemID string) (float64, error) {
	var cost float64
	err := tx.Table("inventory_items").
		Select("COALESCE(average_unit_cost, 0)").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", inventoryItemID, businessID).
		Scan(&cost).Error
	return cost, err
}

func (r *Repository) CreatePriceSuggestion(tx *gorm.DB, suggestion *ProductPriceSuggestion) error {
	return tx.Create(suggestion).Error
}

func (r *Repository) FindPriceSuggestionForUpdate(tx *gorm.DB, businessID, id string) (*ProductPriceSuggestion, error) {
	var suggestion ProductPriceSuggestion
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		Take(&suggestion).Error
	if err != nil {
		return nil, err
	}
	return &suggestion, nil
}

func (r *Repository) UpdatePriceSuggestion(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&ProductPriceSuggestion{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListPriceSuggestions(businessID, branchID string, query PriceSuggestionListQuery) ([]ProductPriceSuggestionResponse, int64, error) {
	db := r.db.Table("product_price_suggestions pps").
		Joins("JOIN products p ON p.id = pps.product_id AND p.business_id = pps.business_id AND p.deleted_at IS NULL").
		Joins("LEFT JOIN product_variants pv ON pv.id = pps.product_variant_id AND pv.business_id = pps.business_id AND pv.deleted_at IS NULL").
		Where("pps.business_id = ? AND pps.deleted_at IS NULL", businessID)
	if branchID != "" {
		db = db.Where("pps.branch_id = ?", branchID)
	}
	if query.Status != "" && query.Status != "all" {
		db = db.Where("pps.status = ?", query.Status)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []ProductPriceSuggestionResponse
	err := db.Select(`pps.id, pps.business_id, pps.branch_id, pps.product_id, p.product_name, p.product_code,
			pps.product_variant_id, COALESCE(pv.variant_name, '') AS product_variant_name,
			pps.current_cost, pps.previous_cost, pps.current_sale_price, pps.suggested_sale_price,
			pps.pricing_type, pps.pricing_percent, pps.source_type, pps.source_id, pps.source_number,
			pps.reason, pps.status, pps.applied_at, pps.dismissed_at, pps.created_at, pps.updated_at`).
		Order("pps.created_at DESC").
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) PriceSuggestionResponse(tx *gorm.DB, businessID, id string) (ProductPriceSuggestionResponse, error) {
	var row ProductPriceSuggestionResponse
	err := tx.Table("product_price_suggestions pps").
		Select(`pps.id, pps.business_id, pps.branch_id, pps.product_id, p.product_name, p.product_code,
			pps.product_variant_id, COALESCE(pv.variant_name, '') AS product_variant_name,
			pps.current_cost, pps.previous_cost, pps.current_sale_price, pps.suggested_sale_price,
			pps.pricing_type, pps.pricing_percent, pps.source_type, pps.source_id, pps.source_number,
			pps.reason, pps.status, pps.applied_at, pps.dismissed_at, pps.created_at, pps.updated_at`).
		Joins("JOIN products p ON p.id = pps.product_id AND p.business_id = pps.business_id AND p.deleted_at IS NULL").
		Joins("LEFT JOIN product_variants pv ON pv.id = pps.product_variant_id AND pv.business_id = pps.business_id AND pv.deleted_at IS NULL").
		Where("pps.id = ? AND pps.business_id = ? AND pps.deleted_at IS NULL", id, businessID).
		Take(&row).Error
	return row, err
}
