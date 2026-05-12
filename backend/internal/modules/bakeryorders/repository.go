package bakeryorders

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
	var count int64
	if err := tx.Model(&BakeryOrder{}).Where("business_id = ?", businessID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("ORD-%06d", count+1), nil
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
		Select("bop.id, bop.bakery_order_id, bop.payment_method_id, bop.payment_method_name_snapshot, bop.amount, bop.reference_number, bop.payment_type, bop.paid_by_user_id, u.full_name AS paid_by_user_name, bop.paid_at, bop.created_at").
		Joins("LEFT JOIN users u ON u.id = bop.paid_by_user_id").
		Where("bop.business_id = ? AND bop.bakery_order_id = ?", businessID, orderID).
		Order("bop.paid_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) CreatePayment(tx *gorm.DB, payment *BakeryOrderPayment) error {
	return tx.Create(payment).Error
}

func (r *Repository) Production(businessID, orderID string) (*BakeryOrderProductionResponse, error) {
	var row BakeryOrderProductionResponse
	result := r.db.Table("bakery_order_productions bop").
		Select("bop.id, bop.bakery_order_id, bop.production_batch_id, pb.production_batch_number, bop.status, bop.created_at, bop.updated_at").
		Joins("LEFT JOIN production_batches pb ON pb.id = bop.production_batch_id").
		Where("bop.business_id = ? AND bop.bakery_order_id = ?", businessID, orderID).
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

func (r *Repository) UpsertProduction(tx *gorm.DB, production *BakeryOrderProduction) error {
	var existing BakeryOrderProduction
	err := tx.Where("business_id = ? AND bakery_order_id = ?", production.BusinessID, production.BakeryOrderID).Take(&existing).Error
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
		Select("bop.id, bop.bakery_order_id, bop.packaging_item_id, bop.packaging_name_snapshot, bop.quantity_required, bop.unit_id, u.symbol AS unit_symbol, bop.created_at, bop.updated_at").
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
	err := tx.Table("products").Select("id, product_name, tax_rate_id, status").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", productID, businessID, branchID).Take(&row).Error
	return &row, err
}

func (r *Repository) ValidateUnit(tx *gorm.DB, businessID, unitID string) error {
	return exists(tx.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND status = ? AND deleted_at IS NULL", unitID, businessID, "active"))
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
	err := tx.Table("payment_methods").Select("id, method_name, requires_reference").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", methodID, businessID, "active").Take(&row).Error
	return &row, err
}

func (r *Repository) ProductionBatch(tx *gorm.DB, businessID, branchID, batchID string) error {
	return exists(tx.Table("production_batches").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", batchID, businessID, branchID))
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
		db = db.Where("LOWER(order_number) LIKE ? OR LOWER(customer_name_snapshot) LIKE ? OR LOWER(customer_phone_snapshot) LIKE ?", like, like, like)
	}
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.CustomerID != "" {
		db = db.Where("customer_id = ?", query.CustomerID)
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
