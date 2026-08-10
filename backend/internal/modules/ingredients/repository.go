package ingredients

import (
	"fmt"
	"math"
	"strings"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(tx *gorm.DB, item *Ingredient) error {
	return tx.Create(item).Error
}

func (r *Repository) FindByID(id, businessID, branchID string) (*Ingredient, error) {
	var item Ingredient
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&item).Error
	return &item, err
}

func (r *Repository) Update(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&Ingredient{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) List(businessID, branchID string, query ListQuery) ([]Ingredient, int64, error) {
	db := r.db.Model(&Ingredient{}).Where("ingredients.business_id = ? AND ingredients.branch_id = ? AND ingredients.deleted_at IS NULL", businessID, branchID)
	db = applyFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []Ingredient
	err := db.Order(fmt.Sprintf("ingredients.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&items).Error
	return items, total, err
}

func (r *Repository) Lookup(businessID, branchID string, query LookupQuery) ([]IngredientLookupItem, error) {
	db := r.db.Table("ingredients i").
		Select("i.id, i.ingredient_name, i.ingredient_code, i.unit_id, u.symbol AS unit_symbol, i.cost_per_unit, i.is_stock_tracked, i.is_expiry_tracked, i.status").
		Joins("JOIN units u ON u.id = i.unit_id").
		Where("i.business_id = ? AND i.branch_id = ? AND i.status = ? AND i.deleted_at IS NULL", businessID, branchID, "active")
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(i.ingredient_name) LIKE ? OR LOWER(i.ingredient_code) LIKE ?", like, like)
	}
	var items []IngredientLookupItem
	err := db.Order("i.ingredient_name ASC").Limit(query.Limit).Scan(&items).Error
	for i := range items {
		items[i].CostPerUnit = roundMoney(items[i].CostPerUnit)
	}
	return items, err
}

func (r *Repository) NextCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+branchID+":ingredients").Error; err != nil {
		return "", err
	}
	return utils.NextSequentialNumber(tx.Table("ingredients").Where("business_id = ? AND branch_id = ?", businessID, branchID), "ingredient_code", "ING-", 6)
}

func (r *Repository) CodeExists(tx *gorm.DB, businessID, branchID, code string) (bool, error) {
	var count int64
	err := tx.Model(&Ingredient{}).Where("business_id = ? AND branch_id = ? AND LOWER(ingredient_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, code).Count(&count).Error
	return count > 0, err
}

func (r *Repository) NameExists(tx *gorm.DB, businessID, branchID, name, excludeID string) (bool, error) {
	db := tx.Model(&Ingredient{}).Where("business_id = ? AND branch_id = ? AND LOWER(ingredient_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, strings.TrimSpace(name))
	if strings.TrimSpace(excludeID) != "" {
		db = db.Where("id <> ?", excludeID)
	}
	var count int64
	err := db.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ValidateCategory(tx *gorm.DB, businessID, branchID, id string) error {
	return exists(tx.Table("ingredient_categories").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", id, businessID, branchID, "active"))
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

func (r *Repository) HasInventory(tx *gorm.DB, businessID, ingredientID string) (bool, error) {
	var count int64
	err := tx.Table("inventory_items").Where("business_id = ? AND item_type = ? AND ingredient_id = ? AND deleted_at IS NULL", businessID, "ingredient", ingredientID).Count(&count).Error
	return count > 0, err
}

func (r *Repository) HasRecipeLines(tx *gorm.DB, businessID, ingredientID string) (bool, error) {
	var count int64
	err := tx.Table("recipe_ingredients").Where("business_id = ? AND ingredient_id = ? AND deleted_at IS NULL", businessID, ingredientID).Count(&count).Error
	return count > 0, err
}

func (r *Repository) ToResponse(businessID string, item Ingredient) IngredientResponse {
	var categoryName, supplierName, unitName, unitSymbol string
	_ = r.db.Table("ingredient_categories").Select("category_name").Where("id = ? AND business_id = ? AND branch_id = ?", item.IngredientCategoryID, businessID, item.BranchID).Scan(&categoryName).Error
	if item.SupplierID != nil {
		_ = r.db.Table("suppliers").Select("supplier_name").Where("id = ? AND business_id = ? AND branch_id = ?", *item.SupplierID, businessID, item.BranchID).Scan(&supplierName).Error
	}
	_ = r.db.Table("units").Select("unit_name").Where("id = ?", item.UnitID).Scan(&unitName).Error
	_ = r.db.Table("units").Select("symbol").Where("id = ?", item.UnitID).Scan(&unitSymbol).Error
	var inventoryID *string
	var id string
	if err := r.db.Table("inventory_items").Select("id").Where("business_id = ? AND branch_id = ? AND item_type = ? AND ingredient_id = ? AND deleted_at IS NULL", businessID, item.BranchID, "ingredient", item.ID).Limit(1).Scan(&id).Error; err == nil && id != "" {
		inventoryID = &id
	}
	return IngredientResponse{
		ID: item.ID, BusinessID: item.BusinessID, BranchID: item.BranchID, IngredientCategoryID: item.IngredientCategoryID, CategoryName: categoryName,
		SupplierID: item.SupplierID, SupplierName: supplierName, IngredientName: item.IngredientName, IngredientCode: item.IngredientCode,
		Description: item.Description, UnitID: item.UnitID, UnitName: unitName, UnitSymbol: unitSymbol, CostPerUnit: roundMoney(item.CostPerUnit),
		IsStockTracked: item.IsStockTracked, IsExpiryTracked: item.IsExpiryTracked, ReorderLevel: roundQuantity(item.ReorderLevel),
		ImageURL: item.ImageURL, ImageFileID: item.ImageFileID, Status: item.Status, InventoryItemID: inventoryID, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

func applyFilters(db *gorm.DB, query ListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(ingredients.ingredient_name) LIKE ? OR LOWER(ingredients.ingredient_code) LIKE ?", like, like)
	}
	if query.IngredientCategoryID != "" {
		db = db.Where("ingredients.ingredient_category_id = ?", query.IngredientCategoryID)
	}
	if query.SupplierID != "" {
		db = db.Where("ingredients.supplier_id = ?", query.SupplierID)
	}
	if query.Status != "" {
		db = db.Where("ingredients.status = ?", query.Status)
	}
	if query.IsStockTracked != nil {
		db = db.Where("ingredients.is_stock_tracked = ?", *query.IsStockTracked)
	}
	if query.IsExpiryTracked != nil {
		db = db.Where("ingredients.is_expiry_tracked = ?", *query.IsExpiryTracked)
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
	case "ingredient_name", "ingredient_code", "cost_per_unit", "status", "updated_at":
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
