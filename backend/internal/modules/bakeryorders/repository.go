package bakeryorders

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

type catalogProductCreate struct {
	ID                     string
	BusinessID             string
	BranchID               string
	CategoryID             string
	UnitID                 string
	ProductName            string
	ProductCode            string
	SKU                    string
	Barcode                string
	Description            string
	ProductType            string
	ItemStructure          string
	SalePrice              float64
	CostPrice              *float64
	IsPOSVisible           bool
	IsStockTracked         bool
	IsExpiryTracked        bool
	IsCustomOrderAvailable bool
	Status                 string
	CreatedBy              string
	UpdatedBy              string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

func (catalogProductCreate) TableName() string { return "products" }

type catalogVariantCreate struct {
	ID          string
	BusinessID  string
	ProductID   string
	VariantName string
	SKU         string
	Barcode     string
	SalePrice   float64
	CostPrice   *float64
	SortOrder   int
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (catalogVariantCreate) TableName() string { return "product_variants" }

func (r *Repository) CreateOrder(tx *gorm.DB, order *BakeryOrder, items []BakeryOrderItem) error {
	if err := tx.Create(order).Error; err != nil {
		return err
	}
	if len(items) > 0 {
		return tx.Create(&items).Error
	}
	return nil
}

func (r *Repository) FindOrder(id, businessID string) (*BakeryOrder, error) {
	var order BakeryOrder
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&order).Error
	return &order, err
}

func (r *Repository) FindOrderForUpdate(tx *gorm.DB, id, businessID string) (*BakeryOrder, error) {
	var order BakeryOrder
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&order).Error
	return &order, err
}

func (r *Repository) UpdateOrder(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&BakeryOrder{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListOrders(businessID string, query OrderListQuery) ([]BakeryOrder, int64, error) {
	db := r.db.Model(&BakeryOrder{}).Where("bakery_orders.business_id = ? AND bakery_orders.deleted_at IS NULL", businessID)
	db = applyOrderFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var orders []BakeryOrder
	err := db.Order(fmt.Sprintf("bakery_orders.%s %s", safeOrderSort(query.SortBy), safeOrderDirection(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&orders).Error
	return orders, total, err
}

func (r *Repository) NextOrderNumber(tx *gorm.DB, businessID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":bakery_orders").Error; err != nil {
		return "", err
	}
	return utils.NextSequentialNumber(tx.Table("bakery_orders").Where("business_id = ?", businessID), "order_number", "ORD-", 6)
}

func (r *Repository) Items(businessID, orderID string) ([]BakeryOrderItem, error) {
	var items []BakeryOrderItem
	err := r.db.Where("business_id = ? AND bakery_order_id = ? AND deleted_at IS NULL", businessID, orderID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) FindItemForUpdate(tx *gorm.DB, businessID, orderID, itemID string) (*BakeryOrderItem, error) {
	var item BakeryOrderItem
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ? AND bakery_order_id = ? AND business_id = ? AND deleted_at IS NULL", itemID, orderID, businessID).First(&item).Error
	return &item, err
}

func (r *Repository) FindItem(businessID, orderID, itemID string) (*BakeryOrderItem, error) {
	var item BakeryOrderItem
	err := r.db.Where("id = ? AND bakery_order_id = ? AND business_id = ? AND deleted_at IS NULL", itemID, orderID, businessID).First(&item).Error
	return &item, err
}

func (r *Repository) CreateItem(tx *gorm.DB, item *BakeryOrderItem) error {
	return tx.Create(item).Error
}

func (r *Repository) UpdateItem(tx *gorm.DB, itemID, orderID, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&BakeryOrderItem{}).Where("id = ? AND bakery_order_id = ? AND business_id = ? AND deleted_at IS NULL", itemID, orderID, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) DeleteItem(tx *gorm.DB, itemID, orderID, businessID string) error {
	result := tx.Model(&BakeryOrderItem{}).Where("id = ? AND bakery_order_id = ? AND business_id = ? AND deleted_at IS NULL", itemID, orderID, businessID).Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) Payments(businessID, orderID string) ([]BakeryOrderPaymentResponse, error) {
	var rows []BakeryOrderPaymentResponse
	err := r.db.Table("bakery_order_payments bop").
		Select("bop.id, bop.bakery_order_id, bop.payment_method_id, bop.payment_method_name_snapshot, bop.amount, bop.reference_number, bop.payment_type, bop.journal_entry_id, bop.paid_by_user_id, u.full_name AS paid_by_user_name, bop.paid_at, bop.created_at").
		Joins("LEFT JOIN users u ON u.id = bop.paid_by_user_id").
		Where("bop.business_id = ? AND bop.bakery_order_id = ?", businessID, orderID).
		Order("bop.paid_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) CreatePayment(tx *gorm.DB, payment *BakeryOrderPayment) error {
	return tx.Create(payment).Error
}

type consumableStockRow struct {
	InventoryItemID *string
	IsStockTracked  bool
	DisplayName     string
}

// FindProductStock resolves an order item's product/variant to its inventory
// item on the order's branch (mirrors the sales-return lookup).
func (r *Repository) FindProductStock(tx *gorm.DB, businessID, branchID, productID string, variantID *string) (*consumableStockRow, error) {
	var row consumableStockRow
	query := tx.Table("products p").
		Select("p.is_stock_tracked, p.product_name AS display_name, ii.id AS inventory_item_id").
		Where("p.id = ? AND p.business_id = ? AND p.branch_id = ? AND p.deleted_at IS NULL", productID, businessID, branchID)
	if variantID != nil && strings.TrimSpace(*variantID) != "" {
		query = query.
			Joins("JOIN product_variants pv ON pv.product_id = p.id AND pv.business_id = p.business_id AND pv.id = ? AND pv.deleted_at IS NULL", strings.TrimSpace(*variantID)).
			Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.product_variant_id = pv.id AND ii.deleted_at IS NULL", branchID, "product_variant")
	} else {
		query = query.
			Joins("LEFT JOIN inventory_items ii ON ii.business_id = p.business_id AND ii.branch_id = ? AND ii.item_type = ? AND ii.product_id = p.id AND ii.product_variant_id IS NULL AND ii.deleted_at IS NULL", branchID, "product")
	}
	err := query.Take(&row).Error
	return &row, err
}

// FindPackagingStock resolves a packaging component to its inventory item on
// the order's branch. A missing row means the packaging is not stock-tracked.
func (r *Repository) FindPackagingStock(tx *gorm.DB, businessID, branchID, packagingItemID string) (*consumableStockRow, error) {
	var row consumableStockRow
	err := tx.Table("inventory_items ii").
		Select("ii.id AS inventory_item_id, true AS is_stock_tracked, COALESCE(pi.packaging_name, '') AS display_name").
		Joins("LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id AND pi.business_id = ii.business_id").
		Where("ii.business_id = ? AND ii.branch_id = ? AND ii.item_type = ? AND ii.packaging_item_id = ? AND ii.deleted_at IS NULL", businessID, branchID, "packaging", packagingItemID).
		Take(&row).Error
	return &row, err
}

// PackagingRows returns the raw packaging requirement rows for an order.
func (r *Repository) PackagingRows(tx *gorm.DB, businessID, orderID string) ([]BakeryOrderPackaging, error) {
	var rows []BakeryOrderPackaging
	err := tx.Where("business_id = ? AND bakery_order_id = ?", businessID, orderID).Find(&rows).Error
	return rows, err
}

type outboundMovementRow struct {
	ID              string
	InventoryItemID string
	Quantity        float64
	TotalCost       float64
}

// OutboundMovements lists the order's un-reversed outbound stock movements,
// used to restock symmetrically on cancellation.
func (r *Repository) OutboundMovements(tx *gorm.DB, businessID, orderID string) ([]outboundMovementRow, error) {
	var rows []outboundMovementRow
	err := tx.Table("stock_movements").
		Select("id, inventory_item_id, quantity, total_cost").
		Where("business_id = ? AND reference_type = ? AND reference_id = ? AND movement_direction = ? AND is_reversed = false", businessID, "bakery_order", orderID, "out").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) MarkMovementReversed(tx *gorm.DB, businessID, movementID, reversalMovementID string) error {
	return tx.Table("stock_movements").
		Where("business_id = ? AND id = ?", businessID, movementID).
		Updates(map[string]interface{}{"is_reversed": true, "reversed_by_movement_id": reversalMovementID}).Error
}

func (r *Repository) CountOrderPayments(tx *gorm.DB, businessID, orderID string) (int64, error) {
	var count int64
	err := tx.Table("bakery_order_payments").
		Where("business_id = ? AND bakery_order_id = ?", businessID, orderID).
		Count(&count).Error
	return count, err
}

func (r *Repository) Production(businessID, orderID string) (*BakeryOrderProductionResponse, error) {
	var row BakeryOrderProductionResponse
	result := r.db.Table("bakery_order_productions bop").
		Select("bop.id, bop.bakery_order_id, bop.bakery_order_item_id, bop.production_batch_id, pb.production_batch_number, bop.status, bop.created_at, bop.updated_at").
		Joins("LEFT JOIN production_batches pb ON pb.id = bop.production_batch_id").
		Where("bop.business_id = ? AND bop.bakery_order_id = ?", businessID, orderID).
		Order("CASE WHEN bop.bakery_order_item_id IS NULL THEN 0 ELSE 1 END, bop.created_at ASC").
		Limit(1).
		Find(&row)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &row, nil
}

func (r *Repository) Productions(businessID, orderID string) ([]BakeryOrderProductionResponse, error) {
	var rows []BakeryOrderProductionResponse
	err := r.db.Table("bakery_order_productions bop").
		Select("bop.id, bop.bakery_order_id, bop.bakery_order_item_id, bop.production_batch_id, pb.production_batch_number, bop.status, bop.created_at, bop.updated_at").
		Joins("LEFT JOIN production_batches pb ON pb.id = bop.production_batch_id").
		Where("bop.business_id = ? AND bop.bakery_order_id = ?", businessID, orderID).
		Order("bop.created_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) UpsertProduction(tx *gorm.DB, production *BakeryOrderProduction) error {
	var existing BakeryOrderProduction
	query := tx.Where("business_id = ? AND bakery_order_id = ?", production.BusinessID, production.BakeryOrderID)
	if production.BakeryOrderItemID != nil {
		query = query.Where("bakery_order_item_id = ?", *production.BakeryOrderItemID)
	} else {
		query = query.Where("bakery_order_item_id IS NULL")
	}
	err := query.Take(&existing).Error
	if err == nil {
		updates := map[string]interface{}{"status": production.Status, "updated_at": time.Now().UTC()}
		if production.ProductionBatchID != nil {
			updates["production_batch_id"] = production.ProductionBatchID
		}
		return tx.Model(&BakeryOrderProduction{}).Where("id = ?", existing.ID).Updates(updates).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	return tx.Create(production).Error
}

func (r *Repository) Packaging(businessID, orderID string) ([]BakeryOrderPackagingResponse, error) {
	var rows []BakeryOrderPackagingResponse
	err := r.db.Table("bakery_order_packaging bop").
		Select("bop.id, bop.bakery_order_id, bop.packaging_item_id, bop.component_product_id, bop.component_variant_id, bop.packaging_name_snapshot, bop.quantity_required, bop.unit_id, u.symbol AS unit_symbol, bop.created_at, bop.updated_at").
		Joins("JOIN units u ON u.id = bop.unit_id").
		Where("bop.business_id = ? AND bop.bakery_order_id = ?", businessID, orderID).
		Order("bop.created_at ASC").
		Scan(&rows).Error
	for i := range rows {
		rows[i].QuantityRequired = roundQuantity(rows[i].QuantityRequired)
	}
	return rows, err
}

func (r *Repository) CreatePackaging(tx *gorm.DB, item *BakeryOrderPackaging) error {
	return tx.Create(item).Error
}

func (r *Repository) Summary(businessID string) (*SummaryResponse, error) {
	return r.summary(businessID, "")
}

func (r *Repository) SummaryByBranch(businessID, branchID string) (*SummaryResponse, error) {
	return r.summary(businessID, branchID)
}

func (r *Repository) summary(businessID, branchID string) (*SummaryResponse, error) {
	var summary SummaryResponse
	base := "business_id = ? AND deleted_at IS NULL"
	args := []interface{}{businessID}
	if branchID != "" {
		base += " AND branch_id = ?"
		args = append(args, branchID)
	}
	if err := r.db.Table("bakery_orders").Where(base, args...).Count(&summary.TotalOrders).Error; err != nil {
		return nil, err
	}
	_ = r.db.Table("bakery_orders").Where(base+" AND order_status IN ?", append(args, []string{"new", "confirmed"})...).Count(&summary.PendingOrders).Error
	_ = r.db.Table("bakery_orders").Where(base+" AND order_status = ?", append(args, "in_production")...).Count(&summary.InProductionOrders).Error
	_ = r.db.Table("bakery_orders").Where(base+" AND order_status = ?", append(args, "ready")...).Count(&summary.ReadyOrders).Error
	_ = r.db.Table("bakery_orders").Where(base+" AND order_status = ?", append(args, "completed")...).Count(&summary.CompletedOrders).Error
	_ = r.db.Table("bakery_orders").Where(base+" AND event_date = ?", append(args, time.Now().UTC().Format("2006-01-02"))...).Count(&summary.TodayOrders).Error
	return &summary, nil
}

func (r *Repository) ValidateBranch(tx *gorm.DB, businessID, branchID string) error {
	return exists(tx.Table("branches").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", branchID, businessID, "active"))
}

func (r *Repository) Customer(tx *gorm.DB, businessID, branchID, customerID string) (*customerRow, error) {
	var row customerRow
	err := tx.Table("customers").Select("id, full_name, phone, status").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", customerID, businessID, branchID).Take(&row).Error
	return &row, err
}

func (r *Repository) Product(tx *gorm.DB, businessID, branchID, productID string) (*productRow, error) {
	var row productRow
	err := tx.Table("products").Select("id, product_name, product_type, unit_id, tax_rate_id, sale_price, status, is_pos_visible, is_stock_tracked").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", productID, businessID, branchID).Take(&row).Error
	return &row, err
}

func (r *Repository) SalesChannel(tx *gorm.DB, businessID, channelID string) (*salesChannelRow, error) {
	var row salesChannelRow
	err := tx.Table("sales_channels").
		Select("id, channel_name, requires_external_order_number, status").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", channelID, businessID, "active").
		Take(&row).Error
	return &row, err
}

func (r *Repository) DefaultSalesChannel(tx *gorm.DB, businessID string) (*salesChannelRow, error) {
	var row salesChannelRow
	err := tx.Table("sales_channels").
		Select("id, channel_name, requires_external_order_number, status").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Order("is_default DESC, channel_name ASC").
		Take(&row).Error
	return &row, err
}

func (r *Repository) ProductVariant(tx *gorm.DB, businessID, branchID, productID, variantID string) (*productVariantRow, error) {
	var row productVariantRow
	err := tx.Table("product_variants pv").
		Select("pv.id, pv.product_id, pv.variant_name, pv.sale_price, pv.status").
		Joins("JOIN products p ON p.id = pv.product_id AND p.business_id = pv.business_id").
		Where("pv.id = ? AND pv.product_id = ? AND pv.business_id = ? AND p.branch_id = ? AND pv.deleted_at IS NULL", variantID, productID, businessID, branchID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) ValidateUnit(tx *gorm.DB, businessID, unitID string) error {
	return exists(tx.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND status = ? AND deleted_at IS NULL", unitID, businessID, "active"))
}

func (r *Repository) ValidateProductCategory(tx *gorm.DB, businessID, branchID, categoryID, productType string) error {
	query := tx.Table("product_categories pc").
		Joins("JOIN product_category_allowed_types pcat ON pcat.product_category_id = pc.id AND pcat.product_type = ?", productType).
		Where("pc.id = ? AND pc.business_id = ? AND pc.branch_id = ? AND pc.status = ? AND pc.deleted_at IS NULL", categoryID, businessID, branchID, "active")
	return exists(query)
}

func (r *Repository) CreateCatalogProduct(tx *gorm.DB, product *catalogProductCreate) error {
	return tx.Create(product).Error
}

func (r *Repository) CreateCatalogVariant(tx *gorm.DB, variant *catalogVariantCreate) error {
	return tx.Create(variant).Error
}

func (r *Repository) UpdateProductVisibility(tx *gorm.DB, businessID, branchID, productID string, visible bool) error {
	return tx.Table("products").
		Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", productID, businessID, branchID).
		Updates(map[string]interface{}{"is_pos_visible": visible, "updated_at": time.Now().UTC()}).Error
}

func (r *Repository) NextProductCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+branchID+":products").Error; err != nil {
		return "", err
	}
	return utils.NextSequentialNumber(tx.Table("products").Where("business_id = ? AND branch_id = ?", businessID, branchID), "product_code", "PRD-", 6)
}

func (r *Repository) ProductValueExists(tx *gorm.DB, businessID, branchID, column, value string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	if column != "product_code" && column != "sku" && column != "barcode" {
		return false, fmt.Errorf("unsupported product uniqueness column %q", column)
	}
	var count int64
	err := tx.Table("products").
		Where("business_id = ? AND branch_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) VariantValueExists(tx *gorm.DB, businessID, column, value string) (bool, error) {
	if strings.TrimSpace(value) == "" {
		return false, nil
	}
	if column != "sku" && column != "barcode" {
		return false, fmt.Errorf("unsupported variant uniqueness column %q", column)
	}
	var count int64
	err := tx.Table("product_variants").
		Where("business_id = ? AND LOWER("+column+") = LOWER(?) AND deleted_at IS NULL", businessID, value).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) TaxRate(tx *gorm.DB, businessID string, taxRateID *string) (*taxRow, error) {
	if taxRateID == nil {
		return nil, nil
	}
	var row taxRow
	err := tx.Table("tax_rates").Select("id, tax_name, rate_percentage, is_inclusive").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", *taxRateID, businessID, "active").Take(&row).Error
	return &row, err
}

func (r *Repository) PaymentMethod(tx *gorm.DB, businessID, methodID string) (*paymentMethodRow, error) {
	var row paymentMethodRow
	err := tx.Table("payment_methods").Select("id, method_name, method_type, requires_reference, show_in_bakery_orders").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", methodID, businessID, "active").Take(&row).Error
	return &row, err
}

func (r *Repository) ProductionBatch(tx *gorm.DB, businessID, branchID, batchID string) error {
	return exists(tx.Table("production_batches").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", batchID, businessID, branchID))
}

func (r *Repository) RecipeForProduction(tx *gorm.DB, businessID, branchID, recipeID string) (*recipeProductionRow, error) {
	var row recipeProductionRow
	err := tx.Table("recipes").
		Select("id, product_id, product_variant_id, is_active, status").
		Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", recipeID, businessID, branchID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) ActiveRecipeForItem(tx *gorm.DB, businessID, branchID, productID string, productVariantID *string) (*recipeProductionRow, error) {
	query := tx.Table("recipes").
		Select("id, product_id, product_variant_id, is_active, status").
		Where("business_id = ? AND branch_id = ? AND product_id = ? AND is_active = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, productID, true, "active")
	if productVariantID != nil {
		query = query.Where("product_variant_id = ?", *productVariantID)
	} else {
		query = query.Where("product_variant_id IS NULL")
	}
	var row recipeProductionRow
	err := query.Order("updated_at DESC").Take(&row).Error
	return &row, err
}

func (r *Repository) PackagingItem(tx *gorm.DB, businessID, branchID, itemID string) (*packagingRow, error) {
	var row packagingRow
	err := tx.Table("packaging_items").Select("id, packaging_name, unit_id, status").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", itemID, businessID, branchID).Take(&row).Error
	return &row, err
}

func (r *Repository) BranchName(businessID, branchID string) string {
	return r.stringLookup("branches", "branch_name", "id = ? AND business_id = ?", branchID, businessID)
}

func (r *Repository) UserName(userID string) string {
	return r.stringLookup("users", "full_name", "id = ?", userID)
}

func (r *Repository) UnitSymbol(unitID string) string {
	return r.stringLookup("units", "symbol", "id = ?", unitID)
}

func (r *Repository) TaxName(businessID string, taxRateID *string) string {
	if taxRateID == nil {
		return ""
	}
	return r.stringLookup("tax_rates", "tax_name", "id = ? AND business_id = ?", *taxRateID, businessID)
}

func (r *Repository) stringLookup(table, column, where string, args ...interface{}) string {
	var value string
	_ = r.db.Table(table).Select(column).Where(where, args...).Limit(1).Scan(&value).Error
	return value
}

func applyOrderFilters(db *gorm.DB, query OrderListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(order_number) LIKE ? OR LOWER(customer_name_snapshot) LIKE ? OR LOWER(customer_phone_snapshot) LIKE ? OR LOWER(external_order_number) LIKE ?", like, like, like, like)
	}
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.CustomerID != "" {
		db = db.Where("customer_id = ?", query.CustomerID)
	}
	if query.SalesChannelID != "" {
		db = db.Where("sales_channel_id = ?", query.SalesChannelID)
	}
	if query.ExternalOrderNumber != "" {
		db = db.Where("LOWER(external_order_number) = LOWER(?)", strings.TrimSpace(query.ExternalOrderNumber))
	}
	if query.OrderType != "" {
		db = db.Where("order_type = ?", query.OrderType)
	}
	if query.OrderStatus != "" {
		db = db.Where("order_status = ?", query.OrderStatus)
	}
	if query.PaymentStatus != "" {
		db = db.Where("payment_status = ?", query.PaymentStatus)
	}
	if query.DateFrom != "" {
		db = db.Where("event_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("event_date <= ?", query.DateTo)
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

func safeOrderSort(value string) string {
	switch value {
	case "order_number", "event_date", "total_amount", "payment_status", "order_status", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func safeOrderDirection(value string) string {
	if strings.ToLower(value) == "asc" {
		return "asc"
	}
	return "desc"
}

// GeneratePaymentRefundNumber issues the next payment_refunds number. The
// advisory-lock key and prefix MUST match the POS repository's generator —
// both modules number the same table, so they serialize on the same lock.
func (r *Repository) GeneratePaymentRefundNumber(tx *gorm.DB, businessID string, createdAt time.Time) (string, error) {
	datePart := createdAt.Format("20060102")
	lockKey := businessID + ":" + datePart + ":payment_refunds"
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", lockKey).Error; err != nil {
		return "", err
	}
	prefix := "PAY-RFND-" + datePart + "-"
	return utils.NextSequentialNumber(tx.Table("payment_refunds").Where("business_id = ?", businessID), "refund_number", prefix, 6)
}

// CreatePaymentRefund inserts a bakery-order payment_refunds row. A raw map
// keeps the bakery module free of a second payment_refunds model.
func (r *Repository) CreatePaymentRefund(tx *gorm.DB, row map[string]interface{}) error {
	return tx.Table("payment_refunds").Create(row).Error
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
