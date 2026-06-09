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

func (r *Repository) FindExistingItem(tx *gorm.DB, businessID, branchID, itemType string, itemID *string, variantID ...*string) (*InventoryItem, error) {
	var item InventoryItem
	query := tx.Where("business_id = ? AND branch_id = ? AND item_type = ? AND deleted_at IS NULL", businessID, branchID, itemType)
	if itemID == nil {
		return &item, gorm.ErrRecordNotFound
	}
	switch itemType {
	case "product":
		query = query.Where("product_id = ? AND product_variant_id IS NULL", *itemID)
	case "product_variant":
		if len(variantID) == 0 || variantID[0] == nil {
			return &item, gorm.ErrRecordNotFound
		}
		query = query.Where("product_id = ? AND product_variant_id = ?", *itemID, *variantID[0])
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

func (r *Repository) CreateStockLocation(tx *gorm.DB, location *StockLocation) error {
	return tx.Create(location).Error
}

func (r *Repository) FindStockLocation(id, businessID string) (*StockLocation, error) {
	var location StockLocation
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&location).Error
	return &location, err
}

func (r *Repository) FindStockLocationForUpdate(tx *gorm.DB, id, businessID string) (*StockLocation, error) {
	var location StockLocation
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		First(&location).Error
	return &location, err
}

func (r *Repository) FindDefaultStockLocation(tx *gorm.DB, businessID, branchID string) (*StockLocation, error) {
	var location StockLocation
	err := tx.Where("business_id = ? AND branch_id = ? AND is_default = true AND status = ? AND deleted_at IS NULL", businessID, branchID, "active").
		First(&location).Error
	return &location, err
}

func (r *Repository) ListStockLocations(businessID string, query StockLocationListQuery) ([]StockLocation, int64, error) {
	db := r.db.Model(&StockLocation{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyStockLocationFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var locations []StockLocation
	err := db.Order(fmt.Sprintf("%s %s", safeStockLocationSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&locations).Error
	return locations, total, err
}

func (r *Repository) UpdateStockLocation(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&StockLocation{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UnsetDefaultStockLocations(tx *gorm.DB, businessID, branchID string) error {
	return tx.Model(&StockLocation{}).
		Where("business_id = ? AND branch_id = ? AND deleted_at IS NULL", businessID, branchID).
		Update("is_default", false).Error
}

func (r *Repository) DeleteStockLocation(tx *gorm.DB, id, businessID string) error {
	result := tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Delete(&StockLocation{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) StockLocationHasStock(tx *gorm.DB, businessID, locationID string) (bool, error) {
	var count int64
	err := tx.Model(&InventoryLocationBalance{}).
		Where("business_id = ? AND stock_location_id = ? AND current_quantity > 0", businessID, locationID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) StockLocationCodeExists(businessID, branchID, code, excludeID string) (bool, error) {
	query := r.db.Model(&StockLocation{}).
		Where("business_id = ? AND branch_id = ? AND LOWER(location_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, code)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	var count int64
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) CreateStockTransfer(tx *gorm.DB, transfer *StockTransfer) error {
	return tx.Create(transfer).Error
}

func (r *Repository) FindStockTransfer(id, businessID string) (*StockTransfer, error) {
	var transfer StockTransfer
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&transfer).Error
	return &transfer, err
}

func (r *Repository) FindStockTransferForUpdate(tx *gorm.DB, id, businessID string) (*StockTransfer, error) {
	var transfer StockTransfer
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		First(&transfer).Error
	return &transfer, err
}

func (r *Repository) UpdateStockTransfer(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&StockTransfer{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListStockTransfers(businessID string, query StockTransferListQuery) ([]StockTransfer, int64, error) {
	db := r.db.Model(&StockTransfer{}).Where("stock_transfers.business_id = ? AND stock_transfers.deleted_at IS NULL", businessID)
	db = applyStockTransferFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var transfers []StockTransfer
	err := db.Order(fmt.Sprintf("%s %s", safeStockTransferSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&transfers).Error
	return transfers, total, err
}

func (r *Repository) NextStockTransferNumber(tx *gorm.DB, businessID string) (string, error) {
	if err := tx.Exec("SELECT id FROM businesses WHERE id = ? FOR UPDATE", businessID).Error; err != nil {
		return "", err
	}
	var count int64
	if err := tx.Model(&StockTransfer{}).Where("business_id = ?", businessID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("TRF-%06d", count+1), nil
}

func (r *Repository) FindLocationBalanceForUpdate(tx *gorm.DB, businessID, inventoryItemID, locationID string) (*InventoryLocationBalance, error) {
	var balance InventoryLocationBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("business_id = ? AND inventory_item_id = ? AND stock_location_id = ?", businessID, inventoryItemID, locationID).
		First(&balance).Error
	return &balance, err
}

func (r *Repository) CreateLocationBalance(tx *gorm.DB, balance *InventoryLocationBalance) error {
	return tx.Create(balance).Error
}

func (r *Repository) UpdateLocationBalance(tx *gorm.DB, balance *InventoryLocationBalance) error {
	return tx.Model(&InventoryLocationBalance{}).
		Where("id = ? AND business_id = ?", balance.ID, balance.BusinessID).
		Updates(map[string]interface{}{
			"current_quantity":   balance.CurrentQuantity,
			"reserved_quantity":  balance.ReservedQuantity,
			"available_quantity": balance.AvailableQuantity,
			"updated_at":         time.Now().UTC(),
		}).Error
}

func (r *Repository) ListLocationBalances(businessID string, query LocationBalanceListQuery) ([]LocationBalanceResponse, int64, error) {
	db := r.locationBalanceBaseQuery(businessID)
	db = applyLocationBalanceFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var rows []LocationBalanceResponse
	err := r.locationBalanceBaseQuery(businessID).
		Scopes(func(inner *gorm.DB) *gorm.DB { return applyLocationBalanceFilters(inner, query) }).
		Order(fmt.Sprintf("%s %s", safeLocationBalanceSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	for i := range rows {
		rows[i].CurrentQuantity = roundQuantity(rows[i].CurrentQuantity)
		rows[i].ReservedQuantity = roundQuantity(rows[i].ReservedQuantity)
		rows[i].AvailableQuantity = roundQuantity(rows[i].AvailableQuantity)
	}
	return rows, total, err
}

func (r *Repository) ItemLocationBreakdown(businessID, inventoryItemID string) ([]LocationBalanceSummary, error) {
	var rows []LocationBalanceSummary
	err := r.db.Table("inventory_location_balances ilb").
		Select(`
			ilb.stock_location_id,
			sl.location_name AS stock_location_name,
			ilb.current_quantity,
			ilb.reserved_quantity,
			ilb.available_quantity
		`).
		Joins("JOIN stock_locations sl ON sl.id = ilb.stock_location_id AND sl.deleted_at IS NULL").
		Where("ilb.business_id = ? AND ilb.inventory_item_id = ?", businessID, inventoryItemID).
		Order("sl.is_default DESC, sl.location_name ASC").
		Scan(&rows).Error
	for i := range rows {
		rows[i].CurrentQuantity = roundQuantity(rows[i].CurrentQuantity)
		rows[i].ReservedQuantity = roundQuantity(rows[i].ReservedQuantity)
		rows[i].AvailableQuantity = roundQuantity(rows[i].AvailableQuantity)
	}
	return rows, err
}

func (r *Repository) locationBalanceBaseQuery(businessID string) *gorm.DB {
	return r.db.Table("inventory_location_balances ilb").
		Select(`
			ilb.inventory_item_id,
			ilb.branch_id,
			b.branch_name,
			ii.item_type,
			CASE
				WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name)
				ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '')
			END AS item_name,
			COALESCE(NULLIF(pv.sku, ''), p.sku, ing.ingredient_code, pi.packaging_code, '') AS item_code,
			ii.product_id,
			ii.product_variant_id,
			COALESCE(pv.variant_name, '') AS variant_name,
			ilb.stock_location_id,
			sl.location_name AS stock_location_name,
			ilb.current_quantity,
			ilb.reserved_quantity,
			ilb.available_quantity,
			u.id AS unit_id,
			u.unit_name AS unit_unit_name,
			u.symbol AS unit_symbol
		`).
		Joins("JOIN inventory_items ii ON ii.id = ilb.inventory_item_id AND ii.deleted_at IS NULL").
		Joins("JOIN branches b ON b.id = ilb.branch_id").
		Joins("JOIN stock_locations sl ON sl.id = ilb.stock_location_id AND sl.deleted_at IS NULL").
		Joins("JOIN units u ON u.id = ii.unit_id").
		Joins("LEFT JOIN products p ON p.id = ii.product_id").
		Joins("LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id").
		Joins("LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id").
		Joins("LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id").
		Where("ilb.business_id = ?", businessID)
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

func (r *Repository) ValidateStockTrackedProduct(businessID, branchID, productID string) error {
	var count int64
	err := r.db.Table("products").
		Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND is_stock_tracked = true AND deleted_at IS NULL", productID, businessID, branchID, "active").
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateProductVariant(businessID, branchID, productID, variantID string) error {
	var count int64
	err := r.db.Table("product_variants pv").
		Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id").
		Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ? AND p.branch_id = ? AND pv.status = ? AND p.status = ? AND p.is_stock_tracked = true AND pv.deleted_at IS NULL AND p.deleted_at IS NULL", variantID, productID, businessID, branchID, "active", "active").
		Count(&count).Error
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

	itemName, sku, barcode, variantName := r.loadItemIdentity(businessID, item)
	locationBalances, _ := r.ItemLocationBreakdown(businessID, item.ID)
	return InventoryItemResponse{
		ID:                 item.ID,
		BusinessID:         item.BusinessID,
		BranchID:           item.BranchID,
		BranchName:         branchName,
		ProductID:          item.ProductID,
		ProductVariantID:   item.ProductVariantID,
		VariantName:        variantName,
		IngredientID:       item.IngredientID,
		PackagingItemID:    item.PackagingItemID,
		ItemType:           item.ItemType,
		ItemName:           itemName,
		SKU:                sku,
		Barcode:            barcode,
		CurrentQuantity:    roundQuantity(item.CurrentQuantity),
		ReservedQuantity:   roundQuantity(item.ReservedQuantity),
		AvailableQuantity:  roundQuantity(item.AvailableQuantity),
		AverageUnitCost:    roundMoney(item.AverageUnitCost),
		InventoryValue:     roundMoney(item.InventoryValue),
		ReorderLevel:       roundQuantity(item.ReorderLevel),
		Unit:               unit,
		LowStock:           item.AvailableQuantity <= item.ReorderLevel,
		LocationBalances:   locationBalances,
		IsExpiryTracked:    item.IsExpiryTracked,
		Status:             item.Status,
		InventoryStatus:    item.Status,
		CanAddOpeningStock: false,
		CreatedAt:          item.CreatedAt,
		UpdatedAt:          item.UpdatedAt,
	}, nil
}

func (r *Repository) ListInventoryWithUninitializedResponses(businessID string, query InventoryListQuery) ([]InventoryItemResponse, int64, error) {
	var rows []inventoryCatalogRow
	sql, args := inventoryCatalogUnionSQL(businessID, query, false)
	if err := r.db.Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	countSQL, countArgs := inventoryCatalogUnionSQL(businessID, query, true)
	if err := r.db.Raw(countSQL, countArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	responses := make([]InventoryItemResponse, 0, len(rows))
	for _, row := range rows {
		responses = append(responses, r.inventoryCatalogRowResponse(row))
	}
	return responses, total, nil
}

func (r *Repository) inventoryCatalogRowResponse(row inventoryCatalogRow) InventoryItemResponse {
	return InventoryItemResponse{
		ID:                 row.ID,
		BusinessID:         row.BusinessID,
		BranchID:           row.BranchID,
		BranchName:         row.BranchName,
		ProductID:          row.ProductID,
		ProductVariantID:   row.ProductVariantID,
		VariantName:        row.VariantName,
		IngredientID:       row.IngredientID,
		PackagingItemID:    row.PackagingItemID,
		ItemType:           row.ItemType,
		ItemName:           row.ItemName,
		SKU:                row.SKU,
		Barcode:            row.Barcode,
		CurrentQuantity:    roundQuantity(row.CurrentQuantity),
		ReservedQuantity:   roundQuantity(row.ReservedQuantity),
		AvailableQuantity:  roundQuantity(row.AvailableQuantity),
		AverageUnitCost:    roundMoney(row.AverageUnitCost),
		InventoryValue:     roundMoney(row.InventoryValue),
		ReorderLevel:       roundQuantity(row.ReorderLevel),
		Unit:               UnitInfo{ID: row.UnitID, UnitName: row.UnitName, Symbol: row.UnitSymbol},
		LowStock:           row.AvailableQuantity <= row.ReorderLevel,
		IsExpiryTracked:    row.IsExpiryTracked,
		Status:             row.Status,
		InventoryStatus:    row.InventoryStatus,
		CanAddOpeningStock: row.CanAddOpeningStock,
		CreatedAt:          row.CreatedAt,
		UpdatedAt:          row.UpdatedAt,
	}
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
		var productID, productVariantID *string
		var variantName string
		if item != nil {
			itemName, _, _, variantName = r.loadItemIdentity(movement.BusinessID, *item)
			productID = item.ProductID
			productVariantID = item.ProductVariantID
		}
		var branchName string
		_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", movement.BranchID, movement.BusinessID).Scan(&branchName).Error
		var createdByName string
		_ = r.db.Table("users").Select("full_name").Where("id = ? AND business_id = ?", movement.CreatedByUserID, movement.BusinessID).Scan(&createdByName).Error
		responses = append(responses, toStockMovementResponse(movement, unit, itemName, productID, productVariantID, variantName, branchName, createdByName, r.stockLocationName(movement.StockLocationID, movement.BusinessID), r.stockLocationName(movement.FromStockLocationID, movement.BusinessID), r.stockLocationName(movement.ToStockLocationID, movement.BusinessID)))
	}
	return responses, nil
}

func (r *Repository) LoadStockLocationResponse(location StockLocation) StockLocationResponse {
	var branchName string
	_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", location.BranchID, location.BusinessID).Scan(&branchName).Error
	return StockLocationResponse{
		ID:              location.ID,
		BusinessID:      location.BusinessID,
		BranchID:        location.BranchID,
		BranchName:      branchName,
		LocationName:    location.LocationName,
		LocationCode:    location.LocationCode,
		LocationType:    location.LocationType,
		Description:     location.Description,
		IsDefault:       location.IsDefault,
		Status:          location.Status,
		CreatedByUserID: location.CreatedByUserID,
		UpdatedByUserID: location.UpdatedByUserID,
		CreatedAt:       location.CreatedAt,
		UpdatedAt:       location.UpdatedAt,
	}
}

func (r *Repository) LoadStockLocationResponses(locations []StockLocation) []StockLocationResponse {
	responses := make([]StockLocationResponse, 0, len(locations))
	for _, location := range locations {
		responses = append(responses, r.LoadStockLocationResponse(location))
	}
	return responses
}

func (r *Repository) LoadStockTransferResponse(transfer StockTransfer) (StockTransferResponse, error) {
	var branchName string
	_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", transfer.BranchID, transfer.BusinessID).Scan(&branchName).Error
	var unit UnitInfo
	if err := r.db.Table("units").Select("id, unit_name, symbol").Where("id = ?", transfer.UnitID).Take(&unit).Error; err != nil {
		return StockTransferResponse{}, err
	}
	item, _ := r.FindInventoryItem(transfer.InventoryItemID, transfer.BusinessID)
	itemName, itemType := "", ""
	if item != nil {
		itemName, _, _, _ = r.loadItemIdentity(transfer.BusinessID, *item)
		itemType = item.ItemType
	}
	var createdByName string
	_ = r.db.Table("users").Select("full_name").Where("id = ? AND business_id = ?", transfer.CreatedByUserID, transfer.BusinessID).Scan(&createdByName).Error
	fromID, toID := transfer.FromStockLocationID, transfer.ToStockLocationID
	return StockTransferResponse{
		ID:                    transfer.ID,
		BusinessID:            transfer.BusinessID,
		BranchID:              transfer.BranchID,
		BranchName:            branchName,
		TransferNumber:        transfer.TransferNumber,
		InventoryItemID:       transfer.InventoryItemID,
		ItemName:              itemName,
		ItemType:              itemType,
		FromStockLocationID:   fromID,
		FromStockLocationName: r.stockLocationName(&fromID, transfer.BusinessID),
		ToStockLocationID:     toID,
		ToStockLocationName:   r.stockLocationName(&toID, transfer.BusinessID),
		Quantity:              roundQuantity(transfer.Quantity),
		Unit:                  unit,
		Reason:                transfer.Reason,
		Notes:                 transfer.Notes,
		Status:                transfer.Status,
		CreatedByUserID:       transfer.CreatedByUserID,
		CreatedByName:         createdByName,
		CompletedByUserID:     transfer.CompletedByUserID,
		CompletedAt:           transfer.CompletedAt,
		CancelledAt:           transfer.CancelledAt,
		CreatedAt:             transfer.CreatedAt,
		UpdatedAt:             transfer.UpdatedAt,
	}, nil
}

func (r *Repository) LoadStockTransferResponses(transfers []StockTransfer) ([]StockTransferResponse, error) {
	responses := make([]StockTransferResponse, 0, len(transfers))
	for _, transfer := range transfers {
		dto, err := r.LoadStockTransferResponse(transfer)
		if err != nil {
			return nil, err
		}
		responses = append(responses, dto)
	}
	return responses, nil
}

func (r *Repository) stockLocationName(locationID *string, businessID string) string {
	if locationID == nil || strings.TrimSpace(*locationID) == "" {
		return ""
	}
	var name string
	_ = r.db.Table("stock_locations").Select("location_name").Where("id = ? AND business_id = ? AND deleted_at IS NULL", *locationID, businessID).Scan(&name).Error
	return name
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

func (r *Repository) loadItemIdentity(businessID string, item InventoryItem) (string, string, string, string) {
	if item.ItemType == "product" && item.ProductID != nil {
		var row struct {
			ProductName string
			SKU         string
			Barcode     string
		}
		_ = r.db.Table("products").Select("product_name, sku, barcode").Where("id = ? AND business_id = ?", *item.ProductID, businessID).Scan(&row).Error
		return row.ProductName, row.SKU, row.Barcode, ""
	}
	if item.ItemType == "product_variant" && item.ProductID != nil && item.ProductVariantID != nil {
		var row struct {
			ProductName string
			ProductSKU  string
			VariantName string
			VariantSKU  string
			Barcode     string
		}
		_ = r.db.Table("product_variants pv").
			Select("p.product_name, p.sku AS product_sku, pv.variant_name, pv.sku AS variant_sku, pv.barcode").
			Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id").
			Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ?", *item.ProductVariantID, *item.ProductID, businessID).
			Scan(&row).Error
		sku := row.VariantSKU
		if strings.TrimSpace(sku) == "" {
			sku = row.ProductSKU
		}
		return strings.TrimSpace(row.ProductName + " - " + row.VariantName), sku, row.Barcode, row.VariantName
	}
	if item.ItemType == "ingredient" {
		if item.IngredientID != nil {
			var row struct {
				IngredientName string
				IngredientCode string
			}
			_ = r.db.Table("ingredients").Select("ingredient_name, ingredient_code").Where("id = ? AND business_id = ?", *item.IngredientID, businessID).Scan(&row).Error
			return row.IngredientName, row.IngredientCode, "", ""
		}
		return "Ingredient", "", "", ""
	}
	if item.ItemType == "packaging" && item.PackagingItemID != nil {
		var row struct {
			PackagingName string
			PackagingCode string
		}
		_ = r.db.Table("packaging_items").Select("packaging_name, packaging_code").Where("id = ? AND business_id = ?", *item.PackagingItemID, businessID).Scan(&row).Error
		return row.PackagingName, row.PackagingCode, "", ""
	}
	return "Packaging Item", "", "", ""
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
			Joins("LEFT JOIN product_variants pv ON pv.id = inventory_items.product_variant_id").
			Joins("LEFT JOIN ingredients ing ON ing.id = inventory_items.ingredient_id").
			Joins("LEFT JOIN packaging_items pi ON pi.id = inventory_items.packaging_item_id").
			Where("LOWER(p.product_name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.barcode) LIKE ? OR LOWER(pv.variant_name) LIKE ? OR LOWER(pv.sku) LIKE ? OR LOWER(pv.barcode) LIKE ? OR LOWER(ing.ingredient_name) LIKE ? OR LOWER(ing.ingredient_code) LIKE ? OR LOWER(pi.packaging_name) LIKE ? OR LOWER(pi.packaging_code) LIKE ?", like, like, like, like, like, like, like, like, like, like)
	}
	return db
}

type inventoryCatalogRow struct {
	ID                 string
	BusinessID         string
	BranchID           string
	BranchName         string
	ProductID          *string
	ProductVariantID   *string
	VariantName        string
	IngredientID       *string
	PackagingItemID    *string
	ItemType           string
	ItemName           string
	SKU                string
	Barcode            string
	CurrentQuantity    float64
	ReservedQuantity   float64
	AvailableQuantity  float64
	AverageUnitCost    float64
	InventoryValue     float64
	ReorderLevel       float64
	UnitID             string
	UnitName           string
	UnitSymbol         string
	IsExpiryTracked    bool
	Status             string
	InventoryStatus    string
	CanAddOpeningStock bool
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

func inventoryCatalogUnionSQL(businessID string, query InventoryListQuery, countOnly bool) (string, []interface{}) {
	args := []interface{}{businessID, businessID, businessID}
	selectClause := "*"
	if countOnly {
		selectClause = "COUNT(*)"
	}
	sql := `
WITH inventory_catalog AS (
  SELECT
    ii.id::text AS id,
    ii.business_id::text AS business_id,
    ii.branch_id::text AS branch_id,
    b.branch_name,
    ii.product_id::text AS product_id,
    ii.product_variant_id::text AS product_variant_id,
    COALESCE(pv.variant_name, '') AS variant_name,
    ii.ingredient_id::text AS ingredient_id,
    ii.packaging_item_id::text AS packaging_item_id,
    ii.item_type,
    CASE
      WHEN ii.item_type = 'product_variant' THEN TRIM(COALESCE(p.product_name, '') || ' - ' || COALESCE(pv.variant_name, ''))
      WHEN ii.item_type = 'product' THEN COALESCE(p.product_name, '')
      WHEN ii.item_type = 'ingredient' THEN COALESCE(ing.ingredient_name, '')
      ELSE COALESCE(pi.packaging_name, '')
    END AS item_name,
    COALESCE(NULLIF(pv.sku, ''), p.sku, ing.ingredient_code, pi.packaging_code, '') AS sku,
    COALESCE(pv.barcode, p.barcode, '') AS barcode,
    ii.current_quantity,
    ii.reserved_quantity,
    ii.available_quantity,
    ii.average_unit_cost,
    ii.inventory_value,
    ii.reorder_level,
    ii.unit_id::text AS unit_id,
    u.unit_name,
    u.symbol AS unit_symbol,
    ii.is_expiry_tracked,
    ii.status,
    ii.status AS inventory_status,
    false AS can_add_opening_stock,
    ii.created_at,
    ii.updated_at
  FROM inventory_items ii
  JOIN branches b ON b.id = ii.branch_id
  JOIN units u ON u.id = ii.unit_id
  LEFT JOIN products p ON p.id = ii.product_id
  LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
  LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
  LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
  WHERE ii.business_id = ? AND ii.deleted_at IS NULL

  UNION ALL

  SELECT
    '' AS id,
    p.business_id::text AS business_id,
    p.branch_id::text AS branch_id,
    b.branch_name,
    p.id::text AS product_id,
    NULL AS product_variant_id,
    '' AS variant_name,
    NULL AS ingredient_id,
    NULL AS packaging_item_id,
    'product' AS item_type,
    p.product_name AS item_name,
    COALESCE(p.sku, '') AS sku,
    COALESCE(p.barcode, '') AS barcode,
    0::numeric AS current_quantity,
    0::numeric AS reserved_quantity,
    0::numeric AS available_quantity,
    0::numeric AS average_unit_cost,
    0::numeric AS inventory_value,
    0::numeric AS reorder_level,
    p.unit_id::text AS unit_id,
    u.unit_name,
    u.symbol AS unit_symbol,
    p.is_expiry_tracked,
    p.status,
    'not_initialized' AS inventory_status,
    true AS can_add_opening_stock,
    p.created_at,
    p.updated_at
  FROM products p
  JOIN branches b ON b.id = p.branch_id
  JOIN units u ON u.id = p.unit_id
  WHERE p.business_id = ? AND p.is_stock_tracked = true AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM inventory_items ii
      WHERE ii.business_id = p.business_id AND ii.branch_id = p.branch_id
        AND ii.item_type = 'product' AND ii.product_id = p.id
        AND ii.product_variant_id IS NULL AND ii.deleted_at IS NULL
    )

  UNION ALL

  SELECT
    '' AS id,
    pv.business_id::text AS business_id,
    p.branch_id::text AS branch_id,
    b.branch_name,
    p.id::text AS product_id,
    pv.id::text AS product_variant_id,
    pv.variant_name,
    NULL AS ingredient_id,
    NULL AS packaging_item_id,
    'product_variant' AS item_type,
    TRIM(p.product_name || ' - ' || pv.variant_name) AS item_name,
    COALESCE(NULLIF(pv.sku, ''), p.sku, '') AS sku,
    COALESCE(pv.barcode, p.barcode, '') AS barcode,
    0::numeric AS current_quantity,
    0::numeric AS reserved_quantity,
    0::numeric AS available_quantity,
    0::numeric AS average_unit_cost,
    0::numeric AS inventory_value,
    0::numeric AS reorder_level,
    p.unit_id::text AS unit_id,
    u.unit_name,
    u.symbol AS unit_symbol,
    p.is_expiry_tracked,
    pv.status,
    'not_initialized' AS inventory_status,
    true AS can_add_opening_stock,
    pv.created_at,
    pv.updated_at
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id
  JOIN branches b ON b.id = p.branch_id
  JOIN units u ON u.id = p.unit_id
  WHERE pv.business_id = ? AND p.is_stock_tracked = true AND pv.deleted_at IS NULL AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM inventory_items ii
      WHERE ii.business_id = pv.business_id AND ii.branch_id = p.branch_id
        AND ii.item_type = 'product_variant' AND ii.product_id = p.id
        AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL
    )
)
SELECT ` + selectClause + ` FROM inventory_catalog WHERE 1 = 1`

	if query.BranchID != "" {
		sql += " AND branch_id = ?"
		args = append(args, query.BranchID)
	}
	if query.ItemType != "" {
		sql += " AND item_type = ?"
		args = append(args, query.ItemType)
	}
	if query.Status != "" {
		sql += " AND status = ?"
		args = append(args, query.Status)
	}
	if query.LowStockOnly {
		sql += " AND available_quantity <= reorder_level"
	}
	if query.ExpiryTracked != nil {
		sql += " AND is_expiry_tracked = ?"
		args = append(args, *query.ExpiryTracked)
	}
	if strings.TrimSpace(query.Search) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		sql += " AND (LOWER(item_name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(barcode) LIKE ? OR LOWER(variant_name) LIKE ?)"
		args = append(args, like, like, like, like)
	}
	if countOnly {
		return sql, args
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	sql += fmt.Sprintf(" ORDER BY %s %s", safeInventoryCatalogSortBy(query.SortBy), sortOrder)
	sql += " LIMIT ? OFFSET ?"
	args = append(args, query.Limit, (query.Page-1)*query.Limit)
	return sql, args
}

func safeInventoryCatalogSortBy(value string) string {
	switch strings.ToLower(value) {
	case "item_name":
		return "item_name"
	case "item_type":
		return "item_type"
	case "current_quantity":
		return "current_quantity"
	case "available_quantity":
		return "available_quantity"
	case "reorder_level":
		return "reorder_level"
	case "status":
		return "status"
	case "updated_at":
		return "updated_at"
	default:
		return "created_at"
	}
}

func applyMovementFilters(db *gorm.DB, query MovementListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Joins("LEFT JOIN inventory_items ii ON ii.id = stock_movements.inventory_item_id").
			Joins("LEFT JOIN products p ON p.id = ii.product_id").
			Joins("LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id").
			Joins("LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id").
			Joins("LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id").
			Where("LOWER(p.product_name) LIKE ? OR LOWER(pv.variant_name) LIKE ? OR LOWER(ing.ingredient_name) LIKE ? OR LOWER(ing.ingredient_code) LIKE ? OR LOWER(pi.packaging_name) LIKE ? OR LOWER(pi.packaging_code) LIKE ? OR LOWER(stock_movements.reference_number) LIKE ? OR LOWER(stock_movements.reason) LIKE ? OR LOWER(stock_movements.notes) LIKE ?", like, like, like, like, like, like, like, like, like)
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

func applyStockLocationFilters(db *gorm.DB, query StockLocationListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.LocationType != "" {
		db = db.Where("location_type = ?", query.LocationType)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(location_name) LIKE ? OR LOWER(location_code) LIKE ?", like, like)
	}
	return db
}

func applyLocationBalanceFilters(db *gorm.DB, query LocationBalanceListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("ilb.branch_id = ?", query.BranchID)
	}
	if query.ItemType != "" {
		db = db.Where("ii.item_type = ?", query.ItemType)
	}
	if query.StockLocationID != "" {
		db = db.Where("ilb.stock_location_id = ?", query.StockLocationID)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(p.product_name) LIKE ? OR LOWER(pv.variant_name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(pv.sku) LIKE ? OR LOWER(ing.ingredient_name) LIKE ? OR LOWER(ing.ingredient_code) LIKE ? OR LOWER(pi.packaging_name) LIKE ? OR LOWER(pi.packaging_code) LIKE ?", like, like, like, like, like, like, like, like)
	}
	return db
}

func applyStockTransferFilters(db *gorm.DB, query StockTransferListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("stock_transfers.branch_id = ?", query.BranchID)
	}
	if query.InventoryItemID != "" {
		db = db.Where("stock_transfers.inventory_item_id = ?", query.InventoryItemID)
	}
	if query.Status != "" {
		db = db.Where("stock_transfers.status = ?", query.Status)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Joins("LEFT JOIN inventory_items ii ON ii.id = stock_transfers.inventory_item_id").
			Joins("LEFT JOIN products p ON p.id = ii.product_id").
			Joins("LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id").
			Joins("LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id").
			Joins("LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id").
			Where("LOWER(stock_transfers.transfer_number) LIKE ? OR LOWER(p.product_name) LIKE ? OR LOWER(pv.variant_name) LIKE ? OR LOWER(ing.ingredient_name) LIKE ? OR LOWER(pi.packaging_name) LIKE ?", like, like, like, like, like)
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

func toStockMovementResponse(movement StockMovement, unit UnitInfo, itemName string, productID, productVariantID *string, variantName, branchName, createdByName, stockLocationName, fromStockLocationName, toStockLocationName string) StockMovementResponse {
	return StockMovementResponse{
		ID:                       movement.ID,
		BusinessID:               movement.BusinessID,
		BranchID:                 movement.BranchID,
		BranchName:               branchName,
		InventoryItemID:          movement.InventoryItemID,
		StockLocationID:          movement.StockLocationID,
		StockLocationName:        stockLocationName,
		FromStockLocationID:      movement.FromStockLocationID,
		FromStockLocationName:    fromStockLocationName,
		ToStockLocationID:        movement.ToStockLocationID,
		ToStockLocationName:      toStockLocationName,
		ItemName:                 itemName,
		ItemType:                 movement.ItemType,
		ProductID:                productID,
		ProductVariantID:         productVariantID,
		VariantName:              variantName,
		MovementType:             movement.MovementType,
		MovementDirection:        movement.MovementDirection,
		Quantity:                 roundQuantity(movement.Quantity),
		BeforeQuantity:           roundQuantity(movement.BeforeQuantity),
		AfterQuantity:            roundQuantity(movement.AfterQuantity),
		UnitCostSnapshot:         roundMoney(movement.UnitCostSnapshot),
		TotalCost:                roundMoney(movement.TotalCost),
		ValuationMethod:          movement.ValuationMethod,
		AccountingJournalEntryID: movement.AccountingJournalEntryID,
		Unit:                     unit,
		ReferenceType:            movement.ReferenceType,
		ReferenceID:              movement.ReferenceID,
		ReferenceNumber:          movement.ReferenceNumber,
		Reason:                   movement.Reason,
		Notes:                    movement.Notes,
		IsReversal:               movement.IsReversal,
		ReversedMovementID:       movement.ReversedMovementID,
		IsReversed:               movement.IsReversed,
		ReversedByMovementID:     movement.ReversedByMovementID,
		CreatedByUserID:          movement.CreatedByUserID,
		CreatedByName:            createdByName,
		CreatedAt:                movement.CreatedAt,
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

func safeStockLocationSortBy(value string) string {
	switch value {
	case "location_name", "location_code", "status", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func safeLocationBalanceSortBy(value string) string {
	switch value {
	case "item_name":
		return "item_name"
	case "current_quantity", "available_quantity":
		return "ilb." + value
	default:
		return "sl.location_name"
	}
}

func safeStockTransferSortBy(value string) string {
	switch value {
	case "quantity", "status", "updated_at":
		return "stock_transfers." + value
	default:
		return "stock_transfers.created_at"
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

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
