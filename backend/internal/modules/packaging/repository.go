package packaging

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

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(tx *gorm.DB, item *PackagingItem) error {
	return tx.Create(item).Error
}

func (r *Repository) FindByID(id, businessID, branchID string) (*PackagingItem, error) {
	var item PackagingItem
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&item).Error
	return &item, err
}

func (r *Repository) Update(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&PackagingItem{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) List(businessID, branchID string, query ListQuery) ([]PackagingItem, int64, error) {
	db := r.db.Model(&PackagingItem{}).Where("packaging_items.business_id = ? AND packaging_items.branch_id = ? AND packaging_items.deleted_at IS NULL", businessID, branchID)
	db = applyFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PackagingItem
	err := db.Order(fmt.Sprintf("packaging_items.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&items).Error
	return items, total, err
}

func (r *Repository) Lookup(businessID, branchID string, query LookupQuery) ([]PackagingLookupItem, error) {
	db := r.db.Table("packaging_items pi").
		Select("pi.id, pi.packaging_name, pi.packaging_code, pi.unit_id, u.symbol AS unit_symbol, pi.cost_per_unit, pi.is_stock_tracked, pi.status").
		Joins("JOIN units u ON u.id = pi.unit_id").
		Where("pi.business_id = ? AND pi.branch_id = ? AND pi.status = ? AND pi.deleted_at IS NULL", businessID, branchID, "active")
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(pi.packaging_name) LIKE ? OR LOWER(pi.packaging_code) LIKE ?", like, like)
	}
	var items []PackagingLookupItem
	err := db.Order("pi.packaging_name ASC").Limit(query.Limit).Scan(&items).Error
	for i := range items {
		items[i].CostPerUnit = roundMoney(items[i].CostPerUnit)
	}
	return items, err
}

func (r *Repository) NextCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+branchID+":packaging").Error; err != nil {
		return "", err
	}
	var count int64
	if err := tx.Model(&PackagingItem{}).Where("business_id = ? AND branch_id = ?", businessID, branchID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("PKG-%06d", count+1), nil
}

func (r *Repository) CodeExists(tx *gorm.DB, businessID, branchID, code string) (bool, error) {
	var count int64
	err := tx.Model(&PackagingItem{}).Where("business_id = ? AND branch_id = ? AND LOWER(packaging_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, code).Count(&count).Error
	return count > 0, err
}

func (r *Repository) ValidateCategory(tx *gorm.DB, businessID, branchID, id string) error {
	return exists(tx.Table("packaging_categories").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", id, businessID, branchID, "active"))
}

func (r *Repository) ValidateSupplier(tx *gorm.DB, businessID, branchID, id string) error {
	if strings.TrimSpace(id) == "" {
		return nil
	}
	return exists(tx.Table("suppliers").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", id, businessID, branchID, "active"))
}

func (r *Repository) ValidateUnit(tx *gorm.DB, businessID, id string) error {
	return exists(tx.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND status = ? AND deleted_at IS NULL", id, businessID, "active"))
}

func (r *Repository) ValidateProduct(tx *gorm.DB, businessID, branchID, id string) error {
	return exists(tx.Table("products").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID))
}

func (r *Repository) FindInventoryItem(tx *gorm.DB, businessID, branchID, packagingID string) (string, error) {
	var id string
	err := tx.Table("inventory_items").
		Select("id").
		Where("business_id = ? AND branch_id = ? AND item_type = ? AND packaging_item_id = ? AND deleted_at IS NULL", businessID, branchID, "packaging", packagingID).
		Take(&id).Error
	return id, err
}

func (r *Repository) CreateUsageRule(tx *gorm.DB, rule *PackagingUsageRule) error {
	if rule.IsDefault {
		if err := tx.Model(&PackagingUsageRule{}).Where("business_id = ? AND branch_id = ? AND product_id = ?", rule.BusinessID, rule.BranchID, rule.ProductID).Update("is_default", false).Error; err != nil {
			return err
		}
	}
	return tx.Create(rule).Error
}

func (r *Repository) ListUsageRules(businessID, branchID, productID string) ([]UsageRuleResponse, error) {
	var rules []UsageRuleResponse
	err := r.db.Table("packaging_usage_rules pur").
		Select("pur.id, pur.business_id, pur.product_id, p.product_name, pur.packaging_item_id, pi.packaging_name, pi.packaging_code, pur.quantity_required, pur.is_default, pur.created_at, pur.updated_at").
		Joins("JOIN products p ON p.id = pur.product_id AND p.business_id = pur.business_id AND p.branch_id = pur.branch_id").
		Joins("JOIN packaging_items pi ON pi.id = pur.packaging_item_id AND pi.business_id = pur.business_id AND pi.branch_id = pur.branch_id").
		Where("pur.business_id = ? AND pur.branch_id = ? AND pur.product_id = ?", businessID, branchID, productID).
		Order("pur.is_default DESC, pi.packaging_name ASC").
		Scan(&rules).Error
	for i := range rules {
		rules[i].QuantityRequired = roundQuantity(rules[i].QuantityRequired)
	}
	return rules, err
}

func (r *Repository) DeleteUsageRule(tx *gorm.DB, businessID, branchID, productID, ruleID string) error {
	result := tx.Where("id = ? AND business_id = ? AND branch_id = ? AND product_id = ?", ruleID, businessID, branchID, productID).Delete(&PackagingUsageRule{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UsageRuleExists(tx *gorm.DB, businessID, branchID, productID, packagingItemID string) (bool, error) {
	var count int64
	err := tx.Model(&PackagingUsageRule{}).Where("business_id = ? AND branch_id = ? AND product_id = ? AND packaging_item_id = ?", businessID, branchID, productID, packagingItemID).Count(&count).Error
	return count > 0, err
}

func (r *Repository) HasUsageRules(tx *gorm.DB, businessID, packagingItemID string) (bool, error) {
	var count int64
	err := tx.Model(&PackagingUsageRule{}).Where("business_id = ? AND packaging_item_id = ?", businessID, packagingItemID).Count(&count).Error
	return count > 0, err
}

func (r *Repository) ToResponse(businessID string, item PackagingItem) PackagingResponse {
	var categoryName, supplierName, unitName, unitSymbol string
	_ = r.db.Table("packaging_categories").Select("category_name").Where("id = ? AND business_id = ? AND branch_id = ?", item.PackagingCategoryID, businessID, item.BranchID).Scan(&categoryName).Error
	if item.SupplierID != nil {
		_ = r.db.Table("suppliers").Select("supplier_name").Where("id = ? AND business_id = ? AND branch_id = ?", *item.SupplierID, businessID, item.BranchID).Scan(&supplierName).Error
	}
	_ = r.db.Table("units").Select("unit_name").Where("id = ?", item.UnitID).Scan(&unitName).Error
	_ = r.db.Table("units").Select("symbol").Where("id = ?", item.UnitID).Scan(&unitSymbol).Error
	var inventoryID *string
	var id string
	if err := r.db.Table("inventory_items").Select("id").Where("business_id = ? AND branch_id = ? AND item_type = ? AND packaging_item_id = ? AND deleted_at IS NULL", businessID, item.BranchID, "packaging", item.ID).Limit(1).Scan(&id).Error; err == nil && id != "" {
		inventoryID = &id
	}
	return PackagingResponse{
		ID: item.ID, BusinessID: item.BusinessID, BranchID: item.BranchID, PackagingCategoryID: item.PackagingCategoryID, CategoryName: categoryName,
		SupplierID: item.SupplierID, SupplierName: supplierName, PackagingName: item.PackagingName, PackagingCode: item.PackagingCode,
		Description: item.Description, UnitID: item.UnitID, UnitName: unitName, UnitSymbol: unitSymbol, CostPerUnit: roundMoney(item.CostPerUnit),
		IsStockTracked: item.IsStockTracked, IsConsumable: item.IsConsumable, ReorderLevel: roundQuantity(item.ReorderLevel),
		ImageURL: item.ImageURL, ImageFileID: item.ImageFileID, Status: item.Status, InventoryItemID: inventoryID, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

func applyFilters(db *gorm.DB, query ListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(packaging_items.packaging_name) LIKE ? OR LOWER(packaging_items.packaging_code) LIKE ?", like, like)
	}
	if query.PackagingCategoryID != "" {
		db = db.Where("packaging_items.packaging_category_id = ?", query.PackagingCategoryID)
	}
	if query.SupplierID != "" {
		db = db.Where("packaging_items.supplier_id = ?", query.SupplierID)
	}
	if query.Status != "" {
		db = db.Where("packaging_items.status = ?", query.Status)
	}
	if query.IsStockTracked != nil {
		db = db.Where("packaging_items.is_stock_tracked = ?", *query.IsStockTracked)
	}
	return db
}

func exists(db *gorm.DB) error {
	var count int64
	if err := db.Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func safeSort(value string) string {
	switch value {
	case "packaging_name", "packaging_code", "cost_per_unit", "status", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func safeOrder(value string) string {
	if strings.ToLower(value) == "asc" {
		return "asc"
	}
	return "desc"
}

func totalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func roundQuantity(value float64) float64 {
	return math.Round(value*10000) / 10000
}

func touch() time.Time {
	return time.Now().UTC()
}
