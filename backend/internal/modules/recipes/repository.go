package recipes

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

func (r *Repository) CreateRecipe(tx *gorm.DB, recipe *Recipe, ingredients []RecipeIngredient, packaging []RecipePackaging) error {
	if err := tx.Create(recipe).Error; err != nil {
		return err
	}
	if len(ingredients) > 0 {
		if err := tx.Create(&ingredients).Error; err != nil {
			return err
		}
	}
	if len(packaging) > 0 {
		if err := tx.Create(&packaging).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) FindRecipe(id, businessID, branchID string) (*Recipe, error) {
	var recipe Recipe
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&recipe).Error
	return &recipe, err
}

func (r *Repository) FindRecipeForUpdate(tx *gorm.DB, id, businessID, branchID string) (*Recipe, error) {
	var recipe Recipe
	err := tx.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&recipe).Error
	return &recipe, err
}

func (r *Repository) UpdateRecipe(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&Recipe{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListRecipes(businessID, branchID string, query ListQuery) ([]Recipe, int64, error) {
	db := r.db.Model(&Recipe{}).Where("recipes.business_id = ? AND recipes.branch_id = ? AND recipes.deleted_at IS NULL", businessID, branchID)
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Joins("LEFT JOIN products p ON p.id = recipes.product_id").
			Where("LOWER(recipes.recipe_name) LIKE ? OR LOWER(recipes.recipe_code) LIKE ? OR LOWER(p.product_name) LIKE ?", like, like, like)
	}
	if query.ProductID != "" {
		db = db.Where("recipes.product_id = ?", query.ProductID)
	}
	if query.Status != "" {
		db = db.Where("recipes.status = ?", query.Status)
	}
	if query.IsActive != nil {
		db = db.Where("recipes.is_active = ?", *query.IsActive)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var recipes []Recipe
	err := db.Order(fmt.Sprintf("recipes.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&recipes).Error
	return recipes, total, err
}

func (r *Repository) Ingredients(recipeID, businessID, branchID string) ([]RecipeIngredient, error) {
	var items []RecipeIngredient
	err := r.db.Where("recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", recipeID, businessID, branchID).Order("sort_order ASC, created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) Packaging(recipeID, businessID, branchID string) ([]RecipePackaging, error) {
	var items []RecipePackaging
	err := r.db.Where("recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", recipeID, businessID, branchID).Order("sort_order ASC, created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) CreateIngredient(tx *gorm.DB, item *RecipeIngredient) error {
	return tx.Create(item).Error
}
func (r *Repository) CreatePackaging(tx *gorm.DB, item *RecipePackaging) error {
	return tx.Create(item).Error
}

func (r *Repository) UpdateIngredient(tx *gorm.DB, id, recipeID, businessID, branchID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&RecipeIngredient{}).Where("id = ? AND recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, recipeID, businessID, branchID).Updates(updates))
}

func (r *Repository) UpdatePackaging(tx *gorm.DB, id, recipeID, businessID, branchID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&RecipePackaging{}).Where("id = ? AND recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, recipeID, businessID, branchID).Updates(updates))
}

func (r *Repository) DeleteIngredient(tx *gorm.DB, id, recipeID, businessID, branchID string) error {
	return updateOne(tx.Model(&RecipeIngredient{}).Where("id = ? AND recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, recipeID, businessID, branchID).Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}))
}

func (r *Repository) DeletePackaging(tx *gorm.DB, id, recipeID, businessID, branchID string) error {
	return updateOne(tx.Model(&RecipePackaging{}).Where("id = ? AND recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, recipeID, businessID, branchID).Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}))
}

func (r *Repository) DeactivateOtherActiveRecipes(tx *gorm.DB, businessID, branchID, productID string, productVariantID *string, exceptRecipeID string) error {
	query := tx.Model(&Recipe{}).Where("business_id = ? AND branch_id = ? AND product_id = ? AND id <> ? AND deleted_at IS NULL", businessID, branchID, productID, exceptRecipeID)
	if productVariantID != nil {
		query = query.Where("product_variant_id = ?", *productVariantID)
	} else {
		query = query.Where("product_variant_id IS NULL")
	}
	return query.
		Updates(map[string]interface{}{"is_active": false, "status": "inactive", "updated_at": time.Now().UTC()}).Error
}

func (r *Repository) NextRecipeCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+branchID+":recipes").Error; err != nil {
		return "", err
	}
	var count int64
	if err := tx.Model(&Recipe{}).Where("business_id = ? AND branch_id = ?", businessID, branchID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("RCP-%06d", count+1), nil
}

func (r *Repository) Product(tx *gorm.DB, businessID, branchID, productID string) (*ProductInfo, error) {
	var p ProductInfo
	err := tx.Table("products").
		Select("id, product_name, product_type, unit_id, sale_price, cost_price, is_stock_tracked, status").
		Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", productID, businessID, branchID, "active").
		Take(&p).Error
	return &p, err
}

func (r *Repository) ProductVariant(tx *gorm.DB, businessID, branchID, productID, variantID string) (*ProductVariantInfo, error) {
	var variant ProductVariantInfo
	err := tx.Table("product_variants pv").
		Select("pv.id, pv.business_id, pv.product_id, pv.variant_name, pv.sku, pv.barcode, pv.sale_price, pv.cost_price, pv.image_file_id, pv.sort_order, pv.status").
		Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id").
		Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ? AND p.branch_id = ? AND pv.deleted_at IS NULL", variantID, productID, businessID, branchID).
		Take(&variant).Error
	return &variant, err
}

func (r *Repository) ProductVariantName(tx *gorm.DB, businessID string, variantID *string) string {
	if variantID == nil {
		return ""
	}
	var name string
	_ = tx.Table("product_variants").Select("variant_name").Where("id = ? AND business_id = ? AND deleted_at IS NULL", *variantID, businessID).Scan(&name).Error
	return name
}

func (r *Repository) ProductVariantNameExists(tx *gorm.DB, businessID, productID, variantName string) (bool, error) {
	var count int64
	err := tx.Table("product_variants").
		Where("business_id = ? AND product_id = ? AND LOWER(variant_name) = LOWER(?) AND deleted_at IS NULL", businessID, productID, strings.TrimSpace(variantName)).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) VariantSKUExists(tx *gorm.DB, businessID, sku string) (bool, error) {
	if strings.TrimSpace(sku) == "" {
		return false, nil
	}
	var count int64
	err := tx.Table("product_variants").
		Where("business_id = ? AND LOWER(sku) = LOWER(?) AND deleted_at IS NULL", businessID, strings.TrimSpace(sku)).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) VariantBarcodeExists(tx *gorm.DB, businessID, barcode string) (bool, error) {
	if strings.TrimSpace(barcode) == "" {
		return false, nil
	}
	var count int64
	err := tx.Table("product_variants").
		Where("business_id = ? AND LOWER(barcode) = LOWER(?) AND deleted_at IS NULL", businessID, strings.TrimSpace(barcode)).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) CreateProductVariant(tx *gorm.DB, variant *ProductVariantInfo) error {
	return tx.Table("product_variants").Create(map[string]interface{}{
		"id":            variant.ID,
		"business_id":   variant.BusinessID,
		"product_id":    variant.ProductID,
		"variant_name":  variant.VariantName,
		"sku":           variant.SKU,
		"barcode":       variant.Barcode,
		"sale_price":    variant.SalePrice,
		"cost_price":    variant.CostPrice,
		"image_file_id": variant.ImageFileID,
		"sort_order":    variant.SortOrder,
		"status":        variant.Status,
		"created_at":    time.Now().UTC(),
		"updated_at":    time.Now().UTC(),
	}).Error
}

func (r *Repository) ValidateUnit(tx *gorm.DB, businessID, unitID string) error {
	return exists(tx.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", unitID, businessID))
}

func (r *Repository) UnitSymbol(unitID string) string {
	var symbol string
	_ = r.db.Table("units").Select("symbol").Where("id = ?", unitID).Scan(&symbol).Error
	return symbol
}

func (r *Repository) InventoryItem(tx *gorm.DB, businessID, branchID, id string) (*InventoryItemInfo, error) {
	var item InventoryItemInfo
	err := tx.Table("inventory_items").Select("id, product_id, ingredient_id, packaging_item_id, item_type, unit_id").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Take(&item).Error
	return &item, err
}

func (r *Repository) PackagingItem(tx *gorm.DB, businessID, branchID, id string) (*PackagingInfo, error) {
	var item PackagingInfo
	err := tx.Table("packaging_items").Select("id, packaging_name, unit_id, cost_per_unit").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", id, businessID, branchID, "active").Take(&item).Error
	return &item, err
}

func (r *Repository) IngredientItem(tx *gorm.DB, businessID, branchID, id string) (*IngredientInfo, error) {
	var item IngredientInfo
	err := tx.Table("ingredients").Select("id, ingredient_name, unit_id, cost_per_unit").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", id, businessID, branchID, "active").Take(&item).Error
	return &item, err
}

func (r *Repository) ItemNameAndCost(tx *gorm.DB, businessID string, item *InventoryItemInfo) (string, float64) {
	if item.ProductID != nil {
		var row struct {
			ProductName string
			CostPrice   *float64
		}
		_ = tx.Table("products").Select("product_name, cost_price").Where("id = ? AND business_id = ?", *item.ProductID, businessID).Scan(&row).Error
		if row.CostPrice != nil {
			return row.ProductName, *row.CostPrice
		}
		return row.ProductName, 0
	}
	if item.PackagingItemID != nil {
		var row struct {
			PackagingName string
			CostPerUnit   float64
		}
		_ = tx.Table("packaging_items").Select("packaging_name, cost_per_unit").Where("id = ? AND business_id = ?", *item.PackagingItemID, businessID).Scan(&row).Error
		return row.PackagingName, row.CostPerUnit
	}
	if item.IngredientID != nil {
		var row struct {
			IngredientName string
			CostPerUnit    float64
		}
		_ = tx.Table("ingredients").Select("ingredient_name, cost_per_unit").Where("id = ? AND business_id = ?", *item.IngredientID, businessID).Scan(&row).Error
		return row.IngredientName, row.CostPerUnit
	}
	return "Ingredient", 0
}

func (r *Repository) CreateVersion(tx *gorm.DB, version *RecipeVersion) error {
	return tx.Create(version).Error
}

func (r *Repository) Versions(recipeID, businessID, branchID string) ([]RecipeVersion, error) {
	var versions []RecipeVersion
	err := r.db.Where("recipe_id = ? AND business_id = ? AND branch_id = ?", recipeID, businessID, branchID).Order("version_number DESC").Find(&versions).Error
	return versions, err
}

func (r *Repository) Lookup(businessID, branchID, search string, limit int) ([]RecipeLookupItem, error) {
	db := r.db.Table("recipes r").Select("r.id, r.recipe_code, r.recipe_name, r.product_id, p.product_name, r.product_variant_id, pv.variant_name AS product_variant_name, r.status, r.is_active").
		Joins("JOIN products p ON p.id = r.product_id AND p.branch_id = r.branch_id").
		Joins("LEFT JOIN product_variants pv ON pv.id = r.product_variant_id AND pv.business_id = r.business_id AND pv.deleted_at IS NULL").
		Where("r.business_id = ? AND r.branch_id = ? AND r.deleted_at IS NULL", businessID, branchID)
	if search != "" {
		like := "%" + strings.ToLower(search) + "%"
		db = db.Where("LOWER(r.recipe_name) LIKE ? OR LOWER(r.recipe_code) LIKE ? OR LOWER(p.product_name) LIKE ?", like, like, like)
	}
	var items []RecipeLookupItem
	err := db.Order("r.recipe_name ASC").Limit(limit).Scan(&items).Error
	return items, err
}

func (r *Repository) ActiveByProduct(businessID, branchID, productID, productVariantID string) (*Recipe, error) {
	var recipe Recipe
	query := r.db.Where("business_id = ? AND branch_id = ? AND product_id = ? AND is_active = ? AND deleted_at IS NULL", businessID, branchID, productID, true)
	if strings.TrimSpace(productVariantID) != "" {
		query = query.Where("product_variant_id = ?", strings.TrimSpace(productVariantID))
	} else {
		query = query.Where("product_variant_id IS NULL")
	}
	err := query.First(&recipe).Error
	return &recipe, err
}

func (r *Repository) ToResponse(businessID string, recipe Recipe, includeLines bool) RecipeResponse {
	product, _ := r.Product(r.db, businessID, recipe.BranchID, recipe.ProductID)
	productName, productType := "", ""
	if product != nil {
		productName = product.ProductName
		productType = product.ProductType
	}
	variantName := r.ProductVariantName(r.db, businessID, recipe.ProductVariantID)
	response := RecipeResponse{
		ID: recipe.ID, BusinessID: recipe.BusinessID, BranchID: recipe.BranchID, ProductID: recipe.ProductID, ProductName: productName, ProductType: productType,
		ProductVariantID: recipe.ProductVariantID, ProductVariantName: variantName,
		RecipeCode: recipe.RecipeCode, RecipeName: recipe.RecipeName, Description: recipe.Description,
		BatchYieldQuantity: roundQuantity(recipe.BatchYieldQuantity), BatchYieldUnitID: recipe.BatchYieldUnitID, BatchYieldUnitSymbol: r.UnitSymbol(recipe.BatchYieldUnitID),
		PreparationTimeMinutes: recipe.PreparationTimeMinutes, Instructions: recipe.Instructions,
		EstimatedIngredientCost: roundMoney(recipe.EstimatedIngredientCost), EstimatedPackagingCost: roundMoney(recipe.EstimatedPackagingCost),
		EstimatedTotalCost: roundMoney(recipe.EstimatedTotalCost), CostPerYieldUnit: roundQuantity(recipe.CostPerYieldUnit),
		VersionNumber: recipe.VersionNumber, IsActive: recipe.IsActive, Status: recipe.Status, CreatedAt: recipe.CreatedAt, UpdatedAt: recipe.UpdatedAt,
	}
	if includeLines {
		ingredients, _ := r.Ingredients(recipe.ID, businessID, recipe.BranchID)
		packaging, _ := r.Packaging(recipe.ID, businessID, recipe.BranchID)
		response.Ingredients = r.ToIngredientResponses(ingredients)
		response.Packaging = r.ToPackagingResponses(packaging)
	}
	return response
}

func (r *Repository) ToIngredientResponses(items []RecipeIngredient) []RecipeIngredientResponse {
	responses := make([]RecipeIngredientResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, RecipeIngredientResponse{
			ID: item.ID, ComponentProductID: item.ComponentProductID, ComponentVariantID: item.ComponentVariantID, IngredientID: item.IngredientID, InventoryItemID: item.InventoryItemID, ItemNameSnapshot: item.ItemNameSnapshot,
			QuantityRequired: roundQuantity(item.QuantityRequired), UnitID: item.UnitID, UnitSymbol: r.UnitSymbol(item.UnitID),
			UnitCostSnapshot: roundMoney(item.UnitCostSnapshot), TotalCost: roundMoney(item.TotalCost), WastagePercentage: roundQuantity(item.WastagePercentage),
			SortOrder: item.SortOrder, Notes: item.Notes, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
		})
	}
	return responses
}

func (r *Repository) ToPackagingResponses(items []RecipePackaging) []RecipePackagingResponse {
	responses := make([]RecipePackagingResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, RecipePackagingResponse{
			ID: item.ID, ComponentProductID: item.ComponentProductID, ComponentVariantID: item.ComponentVariantID, PackagingItemID: item.PackagingItemID, PackagingNameSnapshot: item.PackagingNameSnapshot,
			QuantityRequired: roundQuantity(item.QuantityRequired), UnitID: item.UnitID, UnitSymbol: r.UnitSymbol(item.UnitID),
			UnitCostSnapshot: roundMoney(item.UnitCostSnapshot), TotalCost: roundMoney(item.TotalCost), IsOptional: item.IsOptional,
			SortOrder: item.SortOrder, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
		})
	}
	return responses
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

func updateOne(result *gorm.DB) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func safeSort(value string) string {
	switch value {
	case "recipe_name", "recipe_code", "status", "updated_at", "estimated_total_cost":
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

func roundMoney(value float64) float64    { return math.Round(value*100) / 100 }
func roundQuantity(value float64) float64 { return math.Round(value*10000) / 10000 }

type ProductInfo struct {
	ID             string
	ProductName    string
	ProductType    string
	UnitID         string
	SalePrice      float64
	CostPrice      *float64
	IsStockTracked bool
	Status         string
}

type ProductVariantInfo struct {
	ID          string
	BusinessID  string
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

type InventoryItemInfo struct {
	ID              string
	ProductID       *string
	IngredientID    *string
	PackagingItemID *string
	ItemType        string
	UnitID          string
}

type PackagingInfo struct {
	ID            string
	PackagingName string
	UnitID        string
	CostPerUnit   float64
}

type IngredientInfo struct {
	ID             string
	IngredientName string
	UnitID         string
	CostPerUnit    float64
}
