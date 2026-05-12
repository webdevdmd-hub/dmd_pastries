package inventory

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateInventoryItem(tx *gorm.DB, item *InventoryItem) error {
	return tx.Create(item).Error
}

func (r *Repository) UpdateInventoryItem(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&InventoryItem{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindInventoryItem(id, businessID string) (*InventoryItem, error) {
	var item InventoryItem
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&item).Error
	return &item, err
}

func (r *Repository) FindInventoryItemForUpdate(tx *gorm.DB, id, businessID string) (*InventoryItem, error) {
	var item InventoryItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		First(&item).Error
	return &item, err
}

func (r *Repository) FindExistingItem(tx *gorm.DB, businessID, branchID, itemType string, itemID *string) (*InventoryItem, error) {
	var item InventoryItem
	query := tx.Where("business_id = ? AND branch_id = ? AND item_type = ? AND deleted_at IS NULL", businessID, branchID, itemType)
	if itemID == nil {
		return &item, gorm.ErrRecordNotFound
	}
	switch itemType {
	case "product":
		query = query.Where("product_id = ?", *itemID)
	case "ingredient":
		query = query.Where("ingredient_id = ?", *itemID)
	case "packaging":
		query = query.Where("packaging_item_id = ?", *itemID)
	}
	err := query.First(&item).Error
	return &item, err
}

func (r *Repository) ListInventoryItems(businessID string, query InventoryListQuery) ([]InventoryItem, int64, error) {
	db := r.db.Model(&InventoryItem{}).Where("inventory_items.business_id = ? AND inventory_items.deleted_at IS NULL", businessID)
	db = applyInventoryFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}

	var items []InventoryItem
	err := db.Order(fmt.Sprintf("%s %s", safeInventorySortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&items).Error
	return items, total, err
}

func (r *Repository) CreateStockMovement(tx *gorm.DB, movement *StockMovement) error {
	return tx.Create(movement).Error
}

func (r *Repository) FindStockMovement(id, businessID string) (*StockMovement, error) {
	var movement StockMovement
	err := r.db.Where("id = ? AND business_id = ?", id, businessID).First(&movement).Error
	return &movement, err
}

func (r *Repository) FindStockMovementForUpdate(tx *gorm.DB, id, businessID string) (*StockMovement, error) {
	var movement StockMovement
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ?", id, businessID).
		First(&movement).Error
	return &movement, err
}

func (r *Repository) MarkMovementReversed(tx *gorm.DB, originalID, businessID, reversalID string) error {
	result := tx.Model(&StockMovement{}).
		Where("id = ? AND business_id = ?", originalID, businessID).
		Updates(map[string]interface{}{"is_reversed": true, "reversed_by_movement_id": reversalID})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CreateAdjustment(tx *gorm.DB, adjustment *InventoryAdjustment) error {
	return tx.Create(adjustment).Error
}

func (r *Repository) ListMovements(businessID, inventoryItemID string, query MovementListQuery) ([]StockMovement, int64, error) {
	db := r.db.Model(&StockMovement{}).Where("business_id = ?", businessID)
	if inventoryItemID != "" {
		db = db.Where("inventory_item_id = ?", inventoryItemID)
	}
	db = applyMovementFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var movements []StockMovement
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	err := db.Order(fmt.Sprintf("%s %s", safeMovementSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&movements).Error
	return movements, total, err
}

func (r *Repository) MovementSummary(businessID string, query MovementListQuery) (*StockMovementSummaryResponse, error) {
	db := r.db.Model(&StockMovement{}).Where("business_id = ?", businessID)
	db = applyMovementFilters(db, query)
	var rows []MovementTypeSummaryItem
	if err := db.Select("movement_type, movement_direction AS direction, COALESCE(SUM(quantity), 0) AS total_quantity, COUNT(*) AS count").
		Group("movement_type, movement_direction").
		Order("movement_type ASC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	var response StockMovementSummaryResponse
	response.ByMovementType = rows
	for _, row := range rows {
		response.MovementCount += row.Count
		if row.Direction == "in" {
			response.TotalInQuantity += row.TotalQuantity
		}
		if row.Direction == "out" {
			response.TotalOutQuantity += row.TotalQuantity
		}
	}
	response.TotalInQuantity = roundQuantity(response.TotalInQuantity)
	response.TotalOutQuantity = roundQuantity(response.TotalOutQuantity)
	response.NetQuantity = roundQuantity(response.TotalInQuantity - response.TotalOutQuantity)
	return &response, nil
}

func (r *Repository) LedgerAudit(businessID, inventoryItemID string) (*InventoryLedgerAuditResponse, error) {
	item, err := r.FindInventoryItem(inventoryItemID, businessID)
	if err != nil {
		return nil, err
	}
	var row struct {
		TotalIn  float64
		TotalOut float64
		Count    int64
	}
	if err := r.db.Model(&StockMovement{}).
		Select(`
			COALESCE(SUM(CASE WHEN movement_direction = 'in' THEN quantity ELSE 0 END), 0) AS total_in,
			COALESCE(SUM(CASE WHEN movement_direction = 'out' THEN quantity ELSE 0 END), 0) AS total_out,
			COUNT(*) AS count
		`).
		Where("business_id = ? AND inventory_item_id = ?", businessID, inventoryItemID).
		Scan(&row).Error; err != nil {
		return nil, err
	}
	calculated := roundQuantity(row.TotalIn - row.TotalOut)
	difference := roundQuantity(item.CurrentQuantity - calculated)
	return &InventoryLedgerAuditResponse{
		InventoryItemID:                 inventoryItemID,
		CurrentQuantity:                 roundQuantity(item.CurrentQuantity),
		CalculatedQuantityFromMovements: calculated,
		Difference:                      difference,
		IsBalanced:                      math.Abs(difference) < 0.0001,
		TotalIn:                         roundQuantity(row.TotalIn),
		TotalOut:                        roundQuantity(row.TotalOut),
		MovementCount:                   row.Count,
	}, nil
}

func (r *Repository) CreateExpiryBatch(tx *gorm.DB, batch *ExpiryBatch) error {
	return tx.Create(batch).Error
}

func (r *Repository) FindExpiryBatch(batchID, businessID string) (*ExpiryBatch, error) {
	var batch ExpiryBatch
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", batchID, businessID).First(&batch).Error
	return &batch, err
}

func (r *Repository) UpdateExpiryBatch(tx *gorm.DB, batchID, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&ExpiryBatch{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", batchID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListExpiryBatches(businessID, inventoryItemID string) ([]ExpiryBatch, error) {
	var batches []ExpiryBatch
	err := r.db.Where("business_id = ? AND inventory_item_id = ? AND deleted_at IS NULL", businessID, inventoryItemID).
		Order("expiry_date ASC").
		Find(&batches).Error
	return batches, err
}

func (r *Repository) ExpiryAlerts(businessID, branchID string, days int) ([]ExpiryBatch, error) {
	query := r.db.Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active")
	if branchID != "" {
		query = query.Where("branch_id = ?", branchID)
	}
	until := time.Now().UTC().AddDate(0, 0, days)
	var batches []ExpiryBatch
	err := query.Where("expiry_date <= ?", until).Order("expiry_date ASC").Find(&batches).Error
	return batches, err
}

func (r *Repository) ValidateBranch(businessID, branchID string) error {
	var count int64
	err := r.db.Table("branches").Where("id = ? AND business_id = ? AND deleted_at IS NULL", branchID, businessID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateProduct(businessID, productID string) error {
	var count int64
	err := r.db.Table("products").Where("id = ? AND business_id = ? AND deleted_at IS NULL", productID, businessID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateIngredient(businessID, ingredientID string) error {
	var count int64
	err := r.db.Table("ingredients").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", ingredientID, businessID, "active").Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateUnit(businessID, unitID string) error {
	var count int64
	err := r.db.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", unitID, businessID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) LoadInventoryResponses(businessID string, items []InventoryItem) ([]InventoryItemResponse, error) {
	responses := make([]InventoryItemResponse, 0, len(items))
	for _, item := range items {
		response, err := r.LoadInventoryResponse(businessID, item)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadInventoryResponse(businessID string, item InventoryItem) (InventoryItemResponse, error) {
	var branchName string
	_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", item.BranchID, businessID).Scan(&branchName).Error

	var unit UnitInfo
	if err := r.db.Table("units").Select("id, unit_name, symbol").Where("id = ?", item.UnitID).Take(&unit).Error; err != nil {
		return InventoryItemResponse{}, err
	}

	itemName, sku, barcode := r.loadItemIdentity(businessID, item)
	return InventoryItemResponse{
		ID:                item.ID,
		BusinessID:        item.BusinessID,
		BranchID:          item.BranchID,
		BranchName:        branchName,
		ProductID:         item.ProductID,
		IngredientID:      item.IngredientID,
		PackagingItemID:   item.PackagingItemID,
		ItemType:          item.ItemType,
		ItemName:          itemName,
		SKU:               sku,
		Barcode:           barcode,
		CurrentQuantity:   roundQuantity(item.CurrentQuantity),
		ReservedQuantity:  roundQuantity(item.ReservedQuantity),
		AvailableQuantity: roundQuantity(item.AvailableQuantity),
		ReorderLevel:      roundQuantity(item.ReorderLevel),
		Unit:              unit,
		LowStock:          item.AvailableQuantity <= item.ReorderLevel,
		IsExpiryTracked:   item.IsExpiryTracked,
		Status:            item.Status,
		CreatedAt:         item.CreatedAt,
		UpdatedAt:         item.UpdatedAt,
	}, nil
}

func (r *Repository) LoadMovementResponses(movements []StockMovement) ([]StockMovementResponse, error) {
	responses := make([]StockMovementResponse, 0, len(movements))
	for _, movement := range movements {
		var unit UnitInfo
		if err := r.db.Table("units").Select("id, unit_name, symbol").Where("id = ?", movement.UnitID).Take(&unit).Error; err != nil {
			return nil, err
		}
		item, _ := r.FindInventoryItem(movement.InventoryItemID, movement.BusinessID)
		itemName := ""
		if item != nil {
			itemName, _, _ = r.loadItemIdentity(movement.BusinessID, *item)
		}
		var branchName string
		_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", movement.BranchID, movement.BusinessID).Scan(&branchName).Error
		var createdByName string
		_ = r.db.Table("users").Select("full_name").Where("id = ? AND business_id = ?", movement.CreatedByUserID, movement.BusinessID).Scan(&createdByName).Error
		responses = append(responses, toStockMovementResponse(movement, unit, itemName, branchName, createdByName))
	}
	return responses, nil
}

func (r *Repository) LoadMovementResponse(movement StockMovement) (StockMovementResponse, error) {
	responses, err := r.LoadMovementResponses([]StockMovement{movement})
	if err != nil {
		return StockMovementResponse{}, err
	}
	if len(responses) == 0 {
		return StockMovementResponse{}, gorm.ErrRecordNotFound
	}
	return responses[0], nil
}

func (r *Repository) loadItemIdentity(businessID string, item InventoryItem) (string, string, string) {
	if item.ItemType == "product" && item.ProductID != nil {
		var row struct {
			ProductName string
			SKU         string
			Barcode     string
		}
		_ = r.db.Table("products").Select("product_name, sku, barcode").Where("id = ? AND business_id = ?", *item.ProductID, businessID).Scan(&row).Error
		return row.ProductName, row.SKU, row.Barcode
	}
	if item.ItemType == "ingredient" {
		if item.IngredientID != nil {
			var row struct {
				IngredientName string
				IngredientCode string
			}
			_ = r.db.Table("ingredients").Select("ingredient_name, ingredient_code").Where("id = ? AND business_id = ?", *item.IngredientID, businessID).Scan(&row).Error
			return row.IngredientName, row.IngredientCode, ""
		}
		return "Ingredient", "", ""
	}
	if item.ItemType == "packaging" && item.PackagingItemID != nil {
		var row struct {
			PackagingName string
			PackagingCode string
		}
		_ = r.db.Table("packaging_items").Select("packaging_name, packaging_code").Where("id = ? AND business_id = ?", *item.PackagingItemID, businessID).Scan(&row).Error
		return row.PackagingName, row.PackagingCode, ""
	}
	return "Packaging Item", "", ""
}

func applyInventoryFilters(db *gorm.DB, query InventoryListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("inventory_items.branch_id = ?", query.BranchID)
	}
	if query.ItemType != "" {
		db = db.Where("inventory_items.item_type = ?", query.ItemType)
	}
	if query.Status != "" {
		db = db.Where("inventory_items.status = ?", query.Status)
	}
	if query.LowStockOnly {
		db = db.Where("inventory_items.available_quantity <= inventory_items.reorder_level")
	}
	if query.ExpiryTracked != nil {
		db = db.Where("inventory_items.is_expiry_tracked = ?", *query.ExpiryTracked)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Joins("LEFT JOIN products p ON p.id = inventory_items.product_id").
			Joins("LEFT JOIN ingredients ing ON ing.id = inventory_items.ingredient_id").
			Joins("LEFT JOIN packaging_items pi ON pi.id = inventory_items.packaging_item_id").
			Where("LOWER(p.product_name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.barcode) LIKE ? OR LOWER(ing.ingredient_name) LIKE ? OR LOWER(ing.ingredient_code) LIKE ? OR LOWER(pi.packaging_name) LIKE ? OR LOWER(pi.packaging_code) LIKE ?", like, like, like, like, like, like, like)
	}
	return db
}

func applyMovementFilters(db *gorm.DB, query MovementListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Joins("LEFT JOIN inventory_items ii ON ii.id = stock_movements.inventory_item_id").
			Joins("LEFT JOIN products p ON p.id = ii.product_id").
			Joins("LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id").
			Joins("LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id").
			Where("LOWER(p.product_name) LIKE ? OR LOWER(ing.ingredient_name) LIKE ? OR LOWER(ing.ingredient_code) LIKE ? OR LOWER(pi.packaging_name) LIKE ? OR LOWER(pi.packaging_code) LIKE ? OR LOWER(stock_movements.reference_number) LIKE ? OR LOWER(stock_movements.reason) LIKE ? OR LOWER(stock_movements.notes) LIKE ?", like, like, like, like, like, like, like, like)
	}
	if query.BranchID != "" {
		db = db.Where("stock_movements.branch_id = ?", query.BranchID)
	}
	if query.InventoryItemID != "" {
		db = db.Where("stock_movements.inventory_item_id = ?", query.InventoryItemID)
	}
	if query.ItemType != "" {
		db = db.Where("stock_movements.item_type = ?", query.ItemType)
	}
	if query.MovementType != "" {
		db = db.Where("stock_movements.movement_type = ?", query.MovementType)
	}
	if query.MovementDirection != "" {
		db = db.Where("stock_movements.movement_direction = ?", query.MovementDirection)
	}
	if query.ReferenceType != "" {
		db = db.Where("stock_movements.reference_type = ?", query.ReferenceType)
	}
	if query.ReferenceID != "" {
		db = db.Where("stock_movements.reference_id = ?", query.ReferenceID)
	}
	if query.CreatedByUserID != "" {
		db = db.Where("stock_movements.created_by_user_id = ?", query.CreatedByUserID)
	}
	if query.DateFrom != "" {
		db = db.Where("stock_movements.created_at >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("stock_movements.created_at <= ?", query.DateTo)
	}
	return db
}

func safeMovementSortBy(value string) string {
	switch value {
	case "quantity", "movement_type", "movement_direction":
		return value
	default:
		return "created_at"
	}
}

func toStockMovementResponse(movement StockMovement, unit UnitInfo, itemName, branchName, createdByName string) StockMovementResponse {
	return StockMovementResponse{
		ID:                   movement.ID,
		BusinessID:           movement.BusinessID,
		BranchID:             movement.BranchID,
		BranchName:           branchName,
		InventoryItemID:      movement.InventoryItemID,
		ItemName:             itemName,
		ItemType:             movement.ItemType,
		MovementType:         movement.MovementType,
		MovementDirection:    movement.MovementDirection,
		Quantity:             roundQuantity(movement.Quantity),
		BeforeQuantity:       roundQuantity(movement.BeforeQuantity),
		AfterQuantity:        roundQuantity(movement.AfterQuantity),
		Unit:                 unit,
		ReferenceType:        movement.ReferenceType,
		ReferenceID:          movement.ReferenceID,
		ReferenceNumber:      movement.ReferenceNumber,
		Reason:               movement.Reason,
		Notes:                movement.Notes,
		IsReversal:           movement.IsReversal,
		ReversedMovementID:   movement.ReversedMovementID,
		IsReversed:           movement.IsReversed,
		ReversedByMovementID: movement.ReversedByMovementID,
		CreatedByUserID:      movement.CreatedByUserID,
		CreatedByName:        createdByName,
		CreatedAt:            movement.CreatedAt,
	}
}

func safeInventorySortBy(value string) string {
	switch value {
	case "current_quantity", "available_quantity", "reorder_level", "status", "updated_at":
		return "inventory_items." + value
	default:
		return "inventory_items.created_at"
	}
}

func totalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

func roundQuantity(value float64) float64 {
	return math.Round(value*10000) / 10000
}
