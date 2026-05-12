package products

import (
	"fmt"
	"math"
	"strings"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
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
		Select("id, variant_name, sku, barcode, sale_price, cost_price, image_file_id, sort_order, status").
		Where("product_id = ? AND business_id = ? AND deleted_at IS NULL", product.ID, businessID).
		Order("sort_order ASC, variant_name ASC").
		Scan(&variants).Error; err != nil {
		return ProductResponse{}, err
	}

	return toProductResponse(product, category, unit, taxRate, variants), nil
}

func (r *Repository) FindVariantLookup(businessID, branchID, field, value string) (*ProductVariantInfo, string, error) {
	var row struct {
		ID          string
		ProductID   string
		VariantName string
		SKU         string
		Barcode     string
		SalePrice   float64
		CostPrice   *float64
		ImageFileID string
		SortOrder   int
		Status      string
	}
	if err := r.db.Table("product_variants").
		Select("id, product_id, variant_name, sku, barcode, sale_price, cost_price, image_file_id, sort_order, status").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Where("product_id IN (SELECT id FROM products WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL)", businessID, branchID).
		Where(field+" = ?", value).
		Take(&row).Error; err != nil {
		return nil, "", err
	}
	return &ProductVariantInfo{
		ID:          row.ID,
		VariantName: row.VariantName,
		SKU:         row.SKU,
		Barcode:     row.Barcode,
		SalePrice:   row.SalePrice,
		CostPrice:   row.CostPrice,
		ImageFileID: row.ImageFileID,
		SortOrder:   row.SortOrder,
		Status:      row.Status,
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
