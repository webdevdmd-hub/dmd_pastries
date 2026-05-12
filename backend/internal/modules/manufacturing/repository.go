package manufacturing

import (
	"fmt"
	"math"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) CreateBatch(tx *gorm.DB, batch *ProductionBatch, ingredients []ProductionIngredientConsumption, packaging []ProductionPackagingConsumption) error {
	if err := tx.Create(batch).Error; err != nil {
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

func (r *Repository) FindBatch(id, businessID string) (*ProductionBatch, error) {
	var batch ProductionBatch
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&batch).Error
	return &batch, err
}

func (r *Repository) FindBatchForUpdate(tx *gorm.DB, id, businessID string) (*ProductionBatch, error) {
	var batch ProductionBatch
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&batch).Error
	return &batch, err
}

func (r *Repository) UpdateBatch(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&ProductionBatch{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates))
}

func (r *Repository) DeleteBatch(tx *gorm.DB, id, businessID string) error {
	return updateOne(tx.Model(&ProductionBatch{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Update("deleted_at", gorm.Expr("now()")))
}

func (r *Repository) ListBatches(businessID string, query BatchListQuery) ([]ProductionBatch, int64, error) {
	db := r.db.Model(&ProductionBatch{}).Where("production_batches.business_id = ? AND production_batches.deleted_at IS NULL", businessID)
	db = applyFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var batches []ProductionBatch
	err := db.Order(fmt.Sprintf("production_batches.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&batches).Error
	return batches, total, err
}

func (r *Repository) Ingredients(batchID, businessID string) ([]ProductionIngredientConsumption, error) {
	var items []ProductionIngredientConsumption
	err := r.db.Where("production_batch_id = ? AND business_id = ?", batchID, businessID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) Packaging(batchID, businessID string) ([]ProductionPackagingConsumption, error) {
	var items []ProductionPackagingConsumption
	err := r.db.Where("production_batch_id = ? AND business_id = ?", batchID, businessID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) Output(batchID, businessID string) (*ProductionOutput, error) {
	var output ProductionOutput
	result := r.db.Where("production_batch_id = ? AND business_id = ?", batchID, businessID).Limit(1).Find(&output)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &output, nil
}

func (r *Repository) UpdateIngredient(tx *gorm.DB, id, batchID, businessID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&ProductionIngredientConsumption{}).Where("id = ? AND production_batch_id = ? AND business_id = ?", id, batchID, businessID).Updates(updates))
}

func (r *Repository) UpdatePackaging(tx *gorm.DB, id, batchID, businessID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&ProductionPackagingConsumption{}).Where("id = ? AND production_batch_id = ? AND business_id = ?", id, batchID, businessID).Updates(updates))
}

func (r *Repository) CreateOutput(tx *gorm.DB, output *ProductionOutput) error {
	return tx.Create(output).Error
}

func (r *Repository) NextNumber(tx *gorm.DB, businessID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":production_batches").Error; err != nil {
		return "", err
	}
	var count int64
	if err := tx.Model(&ProductionBatch{}).Where("business_id = ?", businessID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("MFG-%06d", count+1), nil
}

func (r *Repository) ActiveRecipe(tx *gorm.DB, businessID, branchID, recipeID string) (*recipeInfo, error) {
	var recipe recipeInfo
	err := tx.Table("recipes").Select("id, product_id, recipe_name, batch_yield_quantity, batch_yield_unit_id, estimated_ingredient_cost, estimated_packaging_cost, is_active, status").
		Where("id = ? AND business_id = ? AND branch_id = ? AND is_active = ? AND status = ? AND deleted_at IS NULL", recipeID, businessID, branchID, true, "active").
		Take(&recipe).Error
	return &recipe, err
}

func (r *Repository) RecipeIngredients(tx *gorm.DB, businessID, branchID, recipeID string) ([]recipeIngredientInfo, error) {
	var items []recipeIngredientInfo
	err := tx.Table("recipe_ingredients").Select("id, ingredient_id, inventory_item_id, item_name_snapshot, quantity_required, unit_id, unit_cost_snapshot, total_cost, wastage_percentage").
		Where("recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", recipeID, businessID, branchID).
		Order("sort_order ASC, created_at ASC").
		Scan(&items).Error
	return items, err
}

func (r *Repository) RecipePackaging(tx *gorm.DB, businessID, branchID, recipeID string) ([]recipePackagingInfo, error) {
	var items []recipePackagingInfo
	err := tx.Table("recipe_packaging").Select("id, packaging_item_id, packaging_name_snapshot, quantity_required, unit_id, unit_cost_snapshot, total_cost, is_optional").
		Where("recipe_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", recipeID, businessID, branchID).
		Order("sort_order ASC, created_at ASC").
		Scan(&items).Error
	return items, err
}

func (r *Repository) Product(tx *gorm.DB, businessID, branchID, productID string) (*productInfo, error) {
	var product productInfo
	err := tx.Table("products").Select("id, product_name, unit_id, is_expiry_tracked").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", productID, businessID, branchID).Take(&product).Error
	return &product, err
}

func (r *Repository) Ingredient(tx *gorm.DB, businessID, branchID, ingredientID string) (*ingredientInfo, error) {
	var ingredient ingredientInfo
	err := tx.Table("ingredients").Select("id, ingredient_name, unit_id, is_expiry_tracked, reorder_level").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", ingredientID, businessID, branchID, "active").Take(&ingredient).Error
	return &ingredient, err
}

func (r *Repository) ValidateBranch(tx *gorm.DB, businessID, branchID string) error {
	return exists(tx.Table("branches").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", branchID, businessID, "active"))
}

func (r *Repository) UnitSymbol(unitID string) string {
	var symbol string
	_ = r.db.Table("units").Select("symbol").Where("id = ?", unitID).Scan(&symbol).Error
	return symbol
}

func (r *Repository) NameLookups(businessID string, batch ProductionBatch) (branchName, recipeName, productName, createdByName string) {
	_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", batch.BranchID, businessID).Scan(&branchName).Error
	_ = r.db.Table("recipes").Select("recipe_name").Where("id = ? AND business_id = ? AND branch_id = ?", batch.RecipeID, businessID, batch.BranchID).Scan(&recipeName).Error
	_ = r.db.Table("products").Select("product_name").Where("id = ? AND business_id = ? AND branch_id = ?", batch.ProductID, businessID, batch.BranchID).Scan(&productName).Error
	_ = r.db.Table("users").Select("full_name").Where("id = ? AND business_id = ?", batch.CreatedByUserID, businessID).Scan(&createdByName).Error
	return
}

func (r *Repository) Summary(businessID string, query BatchListQuery) (*ManufacturingSummaryResponse, error) {
	base := func() *gorm.DB {
		db := r.db.Model(&ProductionBatch{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
		return applyFilters(db, query)
	}
	var response ManufacturingSummaryResponse
	if err := base().Count(&response.TotalBatches).Error; err != nil {
		return nil, err
	}
	if err := base().Where("status = ?", "completed").Count(&response.CompletedBatches).Error; err != nil {
		return nil, err
	}
	if err := base().Where("status = ?", "in_progress").Count(&response.InProgressBatches).Error; err != nil {
		return nil, err
	}
	if err := base().Where("status = ?", "cancelled").Count(&response.CancelledBatches).Error; err != nil {
		return nil, err
	}
	if err := base().Select("COALESCE(SUM(produced_quantity), 0)").Where("status = ?", "completed").Scan(&response.TotalProducedQuantity).Error; err != nil {
		return nil, err
	}
	if err := base().Select("COALESCE(SUM(total_production_cost), 0)").Where("status = ?", "completed").Scan(&response.TotalProductionCost).Error; err != nil {
		return nil, err
	}
	if err := base().Select("COALESCE(SUM(wastage_quantity), 0)").Scan(&response.TotalWastageQuantity).Error; err != nil {
		return nil, err
	}
	response.TotalProducedQuantity = roundQuantity(response.TotalProducedQuantity)
	response.TotalProductionCost = roundMoney(response.TotalProductionCost)
	response.TotalWastageQuantity = roundQuantity(response.TotalWastageQuantity)
	return &response, nil
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

func applyFilters(db *gorm.DB, query BatchListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Joins("LEFT JOIN recipes r ON r.id = production_batches.recipe_id").
			Joins("LEFT JOIN products p ON p.id = production_batches.product_id").
			Where("LOWER(production_batches.production_batch_number) LIKE ? OR LOWER(r.recipe_name) LIKE ? OR LOWER(p.product_name) LIKE ?", like, like, like)
	}
	if query.BranchID != "" {
		db = db.Where("production_batches.branch_id = ?", query.BranchID)
	}
	if query.ProductID != "" {
		db = db.Where("production_batches.product_id = ?", query.ProductID)
	}
	if query.RecipeID != "" {
		db = db.Where("production_batches.recipe_id = ?", query.RecipeID)
	}
	if query.Status != "" {
		db = db.Where("production_batches.status = ?", query.Status)
	}
	if query.DateFrom != "" {
		db = db.Where("production_batches.production_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("production_batches.production_date <= ?", query.DateTo)
	}
	return db
}

func safeSort(value string) string {
	switch value {
	case "production_batch_number", "production_date", "status", "planned_quantity", "produced_quantity", "total_production_cost", "updated_at":
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

type recipeInfo struct {
	ID                      string
	ProductID               string
	RecipeName              string
	BatchYieldQuantity      float64
	BatchYieldUnitID        string
	EstimatedIngredientCost float64
	EstimatedPackagingCost  float64
	IsActive                bool
	Status                  string
}

type recipeIngredientInfo struct {
	ID                string
	IngredientID      *string
	InventoryItemID   *string
	ItemNameSnapshot  string
	QuantityRequired  float64
	UnitID            string
	UnitCostSnapshot  float64
	TotalCost         float64
	WastagePercentage float64
}

type recipePackagingInfo struct {
	ID                    string
	PackagingItemID       string
	PackagingNameSnapshot string
	QuantityRequired      float64
	UnitID                string
	UnitCostSnapshot      float64
	TotalCost             float64
	IsOptional            bool
}

type productInfo struct {
	ID              string
	ProductName     string
	UnitID          string
	IsExpiryTracked bool
}

type ingredientInfo struct {
	ID              string
	IngredientName  string
	UnitID          string
	IsExpiryTracked bool
	ReorderLevel    float64
}
