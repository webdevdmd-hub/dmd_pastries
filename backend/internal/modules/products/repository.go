package products

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

type ProductHistoryReference struct {
	Reference string `json:"reference"`
	Count     int64  `json:"count"`
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) DB() *gorm.DB {
	return r.db
}

func (r *Repository) Create(tx *gorm.DB, product *Product) error {
	return tx.Create(product).Error
}

func (r *Repository) FindByID(id, businessID, branchID string) (*Product, error) {
	var product Product
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&product).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *Repository) Update(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&Product{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ProductHistoryReferences(businessID, branchID, productID string) ([]ProductHistoryReference, error) {
	checks := []struct {
		reference string
		query     string
		args      []interface{}
	}{
		{
			reference: "inventory_items",
			query:     "SELECT COUNT(*) FROM inventory_items WHERE business_id = ? AND branch_id = ? AND product_id = ? AND deleted_at IS NULL",
			args:      []interface{}{businessID, branchID, productID},
		},
		{
			reference: "stock_movements",
			query: `SELECT COUNT(*)
				FROM stock_movements sm
				JOIN inventory_items ii ON ii.id = sm.inventory_item_id
				WHERE sm.business_id = ? AND sm.branch_id = ? AND ii.product_id = ?`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "sale_items",
			query: `SELECT COUNT(*)
				FROM sale_items si
				JOIN sales s ON s.id = si.sale_id
				WHERE si.business_id = ? AND s.branch_id = ? AND si.product_id = ? AND s.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "held_sale_items",
			query: `SELECT COUNT(*)
				FROM held_sale_items hsi
				JOIN held_sales hs ON hs.id = hsi.held_sale_id
				WHERE hsi.business_id = ? AND hs.branch_id = ? AND hsi.product_id = ? AND hs.status = 'held' AND hs.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "purchase_order_items",
			query: `SELECT COUNT(*)
				FROM purchase_order_items poi
				JOIN purchase_orders po ON po.id = poi.purchase_order_id
				WHERE poi.business_id = ? AND po.branch_id = ? AND poi.product_id = ? AND poi.deleted_at IS NULL AND po.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "purchase_invoice_items",
			query: `SELECT COUNT(*)
				FROM purchase_invoice_items pii
				JOIN purchase_invoices pi ON pi.id = pii.purchase_invoice_id
				WHERE pii.business_id = ? AND pi.branch_id = ? AND pii.product_id = ? AND pii.deleted_at IS NULL AND pi.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "purchase_receipt_items",
			query: `SELECT COUNT(*)
				FROM purchase_receipt_items pri
				JOIN purchase_receipts pr ON pr.id = pri.purchase_receipt_id
				WHERE pri.business_id = ? AND pr.branch_id = ? AND pri.product_id = ? AND pri.deleted_at IS NULL AND pr.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "recipes",
			query:     "SELECT COUNT(*) FROM recipes WHERE business_id = ? AND branch_id = ? AND product_id = ? AND deleted_at IS NULL",
			args:      []interface{}{businessID, branchID, productID},
		},
		{
			reference: "production_batches",
			query:     "SELECT COUNT(*) FROM production_batches WHERE business_id = ? AND branch_id = ? AND product_id = ? AND deleted_at IS NULL",
			args:      []interface{}{businessID, branchID, productID},
		},
		{
			reference: "production_outputs",
			query: `SELECT COUNT(*)
				FROM production_outputs po
				JOIN production_batches pb ON pb.id = po.production_batch_id
				WHERE po.business_id = ? AND pb.branch_id = ? AND po.product_id = ? AND pb.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "bakery_order_items",
			query: `SELECT COUNT(*)
				FROM bakery_order_items boi
				JOIN bakery_orders bo ON bo.id = boi.bakery_order_id
				WHERE boi.business_id = ? AND bo.branch_id = ? AND boi.product_id = ? AND boi.deleted_at IS NULL AND bo.deleted_at IS NULL`,
			args: []interface{}{businessID, branchID, productID},
		},
		{
			reference: "packaging_usage_rules",
			query:     "SELECT COUNT(*) FROM packaging_usage_rules WHERE business_id = ? AND branch_id = ? AND product_id = ?",
			args:      []interface{}{businessID, branchID, productID},
		},
	}

	references := make([]ProductHistoryReference, 0)
	for _, check := range checks {
		var count int64
		if err := r.db.Raw(check.query, check.args...).Scan(&count).Error; err != nil {
			return nil, err
		}
		if count > 0 {
			references = append(references, ProductHistoryReference{
				Reference: check.reference,
				Count:     count,
			})
		}
	}
	return references, nil
}

func (r *Repository) List(businessID, branchID string, query ProductListQuery) ([]Product, int64, error) {
	db := r.db.Model(&Product{}).Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID)
	db = applyProductFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortBy := safeProductSortBy(query.SortBy)
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}

	var products []Product
	err := db.Order(fmt.Sprintf("%s %s", sortBy, sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&products).Error
	return products, total, err
}

func (r *Repository) POSProducts(businessID, branchID string) ([]Product, error) {
	var products []Product
	err := r.db.Where("business_id = ? AND branch_id = ? AND status = ? AND is_pos_visible = ? AND deleted_at IS NULL", businessID, branchID, "active", true).
		Order("product_name ASC").
		Find(&products).Error
	return products, err
}

func (r *Repository) FindPOSByLookup(businessID, branchID, field, value string) (*Product, error) {
	var product Product
	err := r.db.Where("business_id = ? AND branch_id = ? AND status = ? AND is_pos_visible = ? AND deleted_at IS NULL", businessID, branchID, "active", true).
		Where(field+" = ?", value).
		First(&product).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *Repository) NextProductCode(businessID, branchID string) (string, error) {
	var count int64
	if err := r.db.Model(&Product{}).Where("business_id = ? AND branch_id = ?", businessID, branchID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("PRD-%06d", count+1), nil
}

func (r *Repository) ProductCodeExists(businessID, branchID, value, excludeID string) (bool, error) {
	return r.exists("product_code", businessID, branchID, value, excludeID)
}

func (r *Repository) SKUExists(businessID, branchID, value, excludeID string) (bool, error) {
	return r.exists("sku", businessID, branchID, value, excludeID)
}

func (r *Repository) BarcodeExists(businessID, branchID, value, excludeID string) (bool, error) {
	return r.exists("barcode", businessID, branchID, value, excludeID)
}

func (r *Repository) VariantSKUExists(businessID, branchID, value, excludeVariantID string) (bool, error) {
	return r.variantExists("sku", businessID, branchID, value, excludeVariantID)
}

func (r *Repository) VariantBarcodeExists(businessID, branchID, value, excludeVariantID string) (bool, error) {
	return r.variantExists("barcode", businessID, branchID, value, excludeVariantID)
}

func (r *Repository) LoadProductResponses(businessID string, products []Product) ([]ProductResponse, error) {
	responses := make([]ProductResponse, 0, len(products))
	for _, product := range products {
		response, err := r.LoadProductResponse(businessID, product)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadProductResponse(businessID string, product Product) (ProductResponse, error) {
	var category ProductCategoryInfo
	if err := r.db.Table("product_categories").Select("id, category_name, category_code").Where("id = ? AND business_id = ? AND branch_id = ?", product.CategoryID, businessID, product.BranchID).Take(&category).Error; err != nil {
		return ProductResponse{}, err
	}

	var unit ProductUnitInfo
	if err := r.db.Table("units").Select("id, unit_name, symbol").Where("id = ? AND (business_id IS NULL OR business_id = ?)", product.UnitID, businessID).Take(&unit).Error; err != nil {
		return ProductResponse{}, err
	}

	var taxRate *ProductTaxRateInfo
	if product.TaxRateID != nil {
		var tax ProductTaxRateInfo
		if err := r.db.Table("tax_rates").Select("id, tax_name, tax_type, rate_percentage, is_inclusive").Where("id = ? AND business_id = ?", *product.TaxRateID, businessID).Take(&tax).Error; err != nil {
			return ProductResponse{}, err
		}
		taxRate = &tax
	}

	var variants []ProductVariantInfo
	if err := r.db.Table("product_variants").
		Select("id, variant_name, sku, barcode, sale_price, cost_price, cost_update_policy, pricing_type, pricing_percent, minimum_sale_price, suggested_sale_price, auto_price_update_enabled, sale_price_locked, last_purchase_cost, last_purchase_date, last_production_cost, last_production_date, average_inventory_cost, image_file_id, sort_order, status").
		Where("product_id = ? AND business_id = ? AND deleted_at IS NULL", product.ID, businessID).
		Order("sort_order ASC, variant_name ASC").
		Scan(&variants).Error; err != nil {
		return ProductResponse{}, err
	}

	return toProductResponse(product, category, unit, taxRate, variants), nil
}

func (r *Repository) FindVariantLookup(businessID, branchID, field, value string) (*ProductVariantInfo, string, error) {
	var row struct {
		ID                     string
		ProductID              string
		VariantName            string
		SKU                    string
		Barcode                string
		SalePrice              float64
		CostPrice              *float64
		CostUpdatePolicy       string
		PricingType            string
		PricingPercent         float64
		MinimumSalePrice       *float64
		SuggestedSalePrice     *float64
		AutoPriceUpdateEnabled bool
		SalePriceLocked        bool
		LastPurchaseCost       *float64
		LastPurchaseDate       *time.Time
		LastProductionCost     *float64
		LastProductionDate     *time.Time
		AverageInventoryCost   *float64
		ImageFileID            string
		SortOrder              int
		Status                 string
	}
	if err := r.db.Table("product_variants").
		Select("id, product_id, variant_name, sku, barcode, sale_price, cost_price, cost_update_policy, pricing_type, pricing_percent, minimum_sale_price, suggested_sale_price, auto_price_update_enabled, sale_price_locked, last_purchase_cost, last_purchase_date, last_production_cost, last_production_date, average_inventory_cost, image_file_id, sort_order, status").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Where("product_id IN (SELECT id FROM products WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL)", businessID, branchID).
		Where(field+" = ?", value).
		Take(&row).Error; err != nil {
		return nil, "", err
	}
	return &ProductVariantInfo{
		ID:                     row.ID,
		VariantName:            row.VariantName,
		SKU:                    row.SKU,
		Barcode:                row.Barcode,
		SalePrice:              row.SalePrice,
		CostPrice:              row.CostPrice,
		CostUpdatePolicy:       normalizeCostUpdatePolicy(row.CostUpdatePolicy),
		PricingType:            normalizePricingType(row.PricingType),
		PricingPercent:         roundQuantity(row.PricingPercent),
		MinimumSalePrice:       row.MinimumSalePrice,
		SuggestedSalePrice:     row.SuggestedSalePrice,
		AutoPriceUpdateEnabled: row.AutoPriceUpdateEnabled,
		SalePriceLocked:        row.SalePriceLocked,
		LastPurchaseCost:       row.LastPurchaseCost,
		LastPurchaseDate:       row.LastPurchaseDate,
		LastProductionCost:     row.LastProductionCost,
		LastProductionDate:     row.LastProductionDate,
		AverageInventoryCost:   row.AverageInventoryCost,
		ImageFileID:            row.ImageFileID,
		SortOrder:              row.SortOrder,
		Status:                 row.Status,
	}, row.ProductID, nil
}

func (r *Repository) exists(column, businessID, branchID, value, excludeID string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	var count int64
	query := r.db.Model(&Product{}).Where("business_id = ? AND branch_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) variantExists(column, businessID, branchID, value, excludeVariantID string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	var count int64
	query := r.db.Table("product_variants").Where("business_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, value).
		Where("product_id IN (SELECT id FROM products WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL)", businessID, branchID)
	if excludeVariantID != "" {
		query = query.Where("id <> ?", excludeVariantID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func applyProductFilters(db *gorm.DB, query ProductListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(product_name) LIKE ? OR LOWER(product_code) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(barcode) LIKE ?", like, like, like, like)
	}
	if query.CategoryID != "" {
		db = db.Where("category_id = ?", query.CategoryID)
	}
	if query.ProductType != "" {
		db = db.Where("product_type = ?", query.ProductType)
	}
	if query.ItemStructure != "" {
		db = db.Where("item_structure = ?", query.ItemStructure)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.IsPOSVisible != nil {
		db = db.Where("is_pos_visible = ?", *query.IsPOSVisible)
	}
	if query.IsStockTracked != nil {
		db = db.Where("is_stock_tracked = ?", *query.IsStockTracked)
	}
	return db
}

func safeProductSortBy(value string) string {
	switch value {
	case "product_name", "product_code", "sale_price", "status", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func totalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}
