package purchasing

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

func (r *Repository) CreateOrder(tx *gorm.DB, order *PurchaseOrder, items []PurchaseOrderItem) error {
	if err := tx.Create(order).Error; err != nil {
		return err
	}
	return tx.Create(&items).Error
}

func (r *Repository) UpdateOrder(tx *gorm.DB, id, businessID string, updates map[string]interface{}, items []PurchaseOrderItem) error {
	if err := updateOne(tx.Model(&PurchaseOrder{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)); err != nil {
		return err
	}
	if items != nil {
		if err := tx.Model(&PurchaseOrderItem{}).Where("purchase_order_id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
			return err
		}
		if len(items) > 0 {
			return tx.Create(&items).Error
		}
	}
	return nil
}

func (r *Repository) FindOrder(id, businessID string) (*PurchaseOrder, error) {
	var order PurchaseOrder
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&order).Error
	return &order, err
}

func (r *Repository) FindOrderForUpdate(tx *gorm.DB, id, businessID string) (*PurchaseOrder, error) {
	var order PurchaseOrder
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&order).Error
	return &order, err
}

func (r *Repository) ListOrders(businessID string, query ListQuery) ([]PurchaseOrder, int64, error) {
	db := r.db.Model(&PurchaseOrder{}).Where("purchase_orders.business_id = ? AND purchase_orders.deleted_at IS NULL", businessID)
	db = applyCommonFilters(db, "purchase_orders", query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []PurchaseOrder
	err := db.Order(fmt.Sprintf("purchase_orders.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).Limit(query.Limit).Find(&rows).Error
	return rows, total, err
}

func (r *Repository) OrderItems(orderID, businessID string) ([]PurchaseOrderItem, error) {
	var items []PurchaseOrderItem
	err := r.db.Where("purchase_order_id = ? AND business_id = ? AND deleted_at IS NULL", orderID, businessID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) OrderItemsForUpdate(tx *gorm.DB, orderID, businessID string) ([]PurchaseOrderItem, error) {
	var items []PurchaseOrderItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("purchase_order_id = ? AND business_id = ? AND deleted_at IS NULL", orderID, businessID).Find(&items).Error
	return items, err
}

func (r *Repository) UpdateOrderItemReceived(tx *gorm.DB, itemID, businessID string, quantityReceived float64) error {
	return updateOne(tx.Model(&PurchaseOrderItem{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", itemID, businessID).
		Updates(map[string]interface{}{"quantity_received": quantityReceived, "updated_at": time.Now().UTC()}))
}

func (r *Repository) CreateInvoice(tx *gorm.DB, invoice *PurchaseInvoice, items []PurchaseInvoiceItem) error {
	if err := tx.Create(invoice).Error; err != nil {
		return err
	}
	return tx.Create(&items).Error
}

func (r *Repository) UpdateInvoice(tx *gorm.DB, id, businessID string, updates map[string]interface{}, items []PurchaseInvoiceItem) error {
	if err := updateOne(tx.Model(&PurchaseInvoice{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)); err != nil {
		return err
	}
	if items != nil {
		if err := tx.Model(&PurchaseInvoiceItem{}).Where("purchase_invoice_id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
			return err
		}
		if len(items) > 0 {
			return tx.Create(&items).Error
		}
	}
	return nil
}

func (r *Repository) FindInvoice(id, businessID string) (*PurchaseInvoice, error) {
	var invoice PurchaseInvoice
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&invoice).Error
	return &invoice, err
}

func (r *Repository) FindInvoiceForUpdate(tx *gorm.DB, id, businessID string) (*PurchaseInvoice, error) {
	var invoice PurchaseInvoice
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&invoice).Error
	return &invoice, err
}

func (r *Repository) ListInvoices(businessID string, query ListQuery) ([]PurchaseInvoice, int64, error) {
	db := r.db.Model(&PurchaseInvoice{}).Where("purchase_invoices.business_id = ? AND purchase_invoices.deleted_at IS NULL", businessID)
	db = applyCommonFilters(db, "purchase_invoices", query)
	if query.PaymentStatus != "" {
		db = db.Where("purchase_invoices.payment_status = ?", query.PaymentStatus)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []PurchaseInvoice
	err := db.Order(fmt.Sprintf("purchase_invoices.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).Limit(query.Limit).Find(&rows).Error
	return rows, total, err
}

func (r *Repository) InvoiceItems(invoiceID, businessID string) ([]PurchaseInvoiceItem, error) {
	var items []PurchaseInvoiceItem
	err := r.db.Where("purchase_invoice_id = ? AND business_id = ? AND deleted_at IS NULL", invoiceID, businessID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) ActiveInvoiceCountForOrder(tx *gorm.DB, businessID, orderID string) (int64, error) {
	var count int64
	err := tx.Model(&PurchaseInvoice{}).
		Where("business_id = ? AND purchase_order_id = ? AND status <> ? AND deleted_at IS NULL", businessID, orderID, "cancelled").
		Count(&count).Error
	return count, err
}

func (r *Repository) InvoicesForOrder(businessID, orderID string) ([]PurchaseInvoice, error) {
	var invoices []PurchaseInvoice
	err := r.db.Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Order("invoice_date ASC, created_at ASC").
		Find(&invoices).Error
	return invoices, err
}

func (r *Repository) CreateInvoicePayment(tx *gorm.DB, payment *PurchaseInvoicePayment) error {
	return tx.Create(payment).Error
}

func (r *Repository) ListInvoicePayments(businessID, invoiceID string) ([]PurchaseInvoicePaymentResponse, error) {
	var rows []PurchaseInvoicePaymentResponse
	err := r.db.Table("purchase_invoice_payments pip").
		Select(`pip.id AS payment_id, pip.purchase_invoice_id, pi.invoice_number, pip.supplier_id, s.supplier_name,
			pip.branch_id, b.branch_name, pip.payment_method_id,
			pip.payment_method_name_snapshot AS payment_method_name,
			pip.payment_method_type_snapshot AS payment_method_type,
			pip.amount, pip.payment_status, pip.reference_number, pip.paid_by_user_id,
			u.full_name AS paid_by_user_name, pip.paid_at, pip.notes, pip.journal_entry_id,
			pip.created_at, pip.updated_at`).
		Joins("JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id").
		Joins("JOIN suppliers s ON s.id = pip.supplier_id").
		Joins("JOIN branches b ON b.id = pip.branch_id").
		Joins("LEFT JOIN users u ON u.id = pip.paid_by_user_id").
		Where("pip.business_id = ? AND pip.purchase_invoice_id = ? AND pip.deleted_at IS NULL", businessID, invoiceID).
		Order("pip.paid_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListAllInvoicePayments(businessID string, query PaymentListQuery) ([]PurchaseInvoicePaymentResponse, int64, error) {
	db := r.db.Table("purchase_invoice_payments pip").
		Joins("JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id").
		Joins("JOIN suppliers s ON s.id = pip.supplier_id").
		Joins("JOIN branches b ON b.id = pip.branch_id").
		Joins("LEFT JOIN users u ON u.id = pip.paid_by_user_id").
		Where("pip.business_id = ? AND pip.deleted_at IS NULL", businessID)
	db = applyPaymentFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortBy := safePaymentSort(query.SortBy)
	sortOrder := safeOrder(query.SortOrder)
	var rows []PurchaseInvoicePaymentResponse
	err := db.Select(`pip.id AS payment_id, pip.purchase_invoice_id, pi.invoice_number, pip.supplier_id, s.supplier_name,
			pip.branch_id, b.branch_name, pip.payment_method_id,
			pip.payment_method_name_snapshot AS payment_method_name,
			pip.payment_method_type_snapshot AS payment_method_type,
			pip.amount, pip.payment_status, pip.reference_number, pip.paid_by_user_id,
			u.full_name AS paid_by_user_name, pip.paid_at, pip.notes, pip.journal_entry_id,
			pip.created_at, pip.updated_at`).
		Order("pip." + sortBy + " " + sortOrder).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) CompletedInvoicePaymentCount(tx *gorm.DB, businessID, invoiceID string) (int64, error) {
	var count int64
	err := tx.Model(&PurchaseInvoicePayment{}).
		Where("business_id = ? AND purchase_invoice_id = ? AND payment_status = ? AND deleted_at IS NULL", businessID, invoiceID, "completed").
		Count(&count).Error
	return count, err
}

func (r *Repository) InvoicePaymentsForOrder(businessID, orderID string) ([]PurchaseInvoicePaymentResponse, error) {
	var rows []PurchaseInvoicePaymentResponse
	err := r.db.Table("purchase_invoice_payments pip").
		Select(`pip.id AS payment_id, pip.purchase_invoice_id, pi.invoice_number, pip.supplier_id, s.supplier_name,
			pip.branch_id, b.branch_name, pip.payment_method_id,
			pip.payment_method_name_snapshot AS payment_method_name,
			pip.payment_method_type_snapshot AS payment_method_type,
			pip.amount, pip.payment_status, pip.reference_number, pip.paid_by_user_id,
			u.full_name AS paid_by_user_name, pip.paid_at, pip.notes, pip.journal_entry_id,
			pip.created_at, pip.updated_at`).
		Joins("JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id").
		Joins("JOIN suppliers s ON s.id = pip.supplier_id").
		Joins("JOIN branches b ON b.id = pip.branch_id").
		Joins("LEFT JOIN users u ON u.id = pip.paid_by_user_id").
		Where("pip.business_id = ? AND pi.purchase_order_id = ? AND pip.deleted_at IS NULL", businessID, orderID).
		Order("pip.paid_at ASC, pip.created_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) InvoiceNumberExists(tx *gorm.DB, businessID, supplierID, invoiceNumber, excludeID string) (bool, error) {
	db := tx.Model(&PurchaseInvoice{}).Where("business_id = ? AND supplier_id = ? AND LOWER(invoice_number) = LOWER(?) AND deleted_at IS NULL", businessID, supplierID, invoiceNumber)
	if excludeID != "" {
		db = db.Where("id <> ?", excludeID)
	}
	var count int64
	err := db.Count(&count).Error
	return count > 0, err
}

func (r *Repository) CreateReceipt(tx *gorm.DB, receipt *PurchaseReceipt, items []PurchaseReceiptItem) error {
	if err := tx.Create(receipt).Error; err != nil {
		return err
	}
	return tx.Create(&items).Error
}

func (r *Repository) FindReceipt(id, businessID string) (*PurchaseReceipt, error) {
	var receipt PurchaseReceipt
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&receipt).Error
	return &receipt, err
}

func (r *Repository) FindReceiptForUpdate(tx *gorm.DB, id, businessID string) (*PurchaseReceipt, error) {
	var receipt PurchaseReceipt
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&receipt).Error
	return &receipt, err
}

func (r *Repository) ListReceipts(businessID string, query ListQuery) ([]PurchaseReceipt, int64, error) {
	db := r.db.Model(&PurchaseReceipt{}).Where("purchase_receipts.business_id = ? AND purchase_receipts.deleted_at IS NULL", businessID)
	db = applyCommonFilters(db, "purchase_receipts", query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []PurchaseReceipt
	err := db.Order(fmt.Sprintf("purchase_receipts.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).Limit(query.Limit).Find(&rows).Error
	return rows, total, err
}

func (r *Repository) ActiveReceiptCountForInvoice(tx *gorm.DB, businessID, invoiceID string) (int64, error) {
	var count int64
	err := tx.Model(&PurchaseReceipt{}).
		Where("business_id = ? AND purchase_invoice_id = ? AND status <> ? AND deleted_at IS NULL", businessID, invoiceID, "cancelled").
		Count(&count).Error
	return count, err
}

func (r *Repository) ReceiptsForOrder(businessID, orderID string) ([]PurchaseReceipt, error) {
	var receipts []PurchaseReceipt
	err := r.db.Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Order("received_date ASC, created_at ASC").
		Find(&receipts).Error
	return receipts, err
}

func (r *Repository) ReceiptItems(receiptID, businessID string) ([]PurchaseReceiptItem, error) {
	var items []PurchaseReceiptItem
	err := r.db.Where("purchase_receipt_id = ? AND business_id = ? AND deleted_at IS NULL", receiptID, businessID).Order("created_at ASC").Find(&items).Error
	return items, err
}

func (r *Repository) ReceiptItemsForUpdate(tx *gorm.DB, receiptID, businessID string) ([]PurchaseReceiptItem, error) {
	var items []PurchaseReceiptItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("purchase_receipt_id = ? AND business_id = ? AND deleted_at IS NULL", receiptID, businessID).
		Order("created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *Repository) UpdateReceiptItemStockMovement(tx *gorm.DB, itemID, businessID, stockMovementID string) error {
	return updateOne(tx.Model(&PurchaseReceiptItem{}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", itemID, businessID).
		Updates(map[string]interface{}{"stock_movement_id": stockMovementID, "updated_at": time.Now().UTC()}))
}

func (r *Repository) UpdateReceipt(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&PurchaseReceipt{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates))
}

func (r *Repository) CreatePurchaseReturn(tx *gorm.DB, purchaseReturn *PurchaseReturn, items []PurchaseReturnItem) error {
	if err := tx.Create(purchaseReturn).Error; err != nil {
		return err
	}
	return tx.Create(&items).Error
}

func (r *Repository) UpdatePurchaseReturn(tx *gorm.DB, id, businessID string, updates map[string]interface{}, items []PurchaseReturnItem) error {
	if err := updateOne(tx.Model(&PurchaseReturn{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)); err != nil {
		return err
	}
	if items != nil {
		if err := tx.Model(&PurchaseReturnItem{}).
			Where("purchase_return_id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
			Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
			return err
		}
		if len(items) > 0 {
			return tx.Create(&items).Error
		}
	}
	return nil
}

func (r *Repository) FindPurchaseReturn(id, businessID string) (*PurchaseReturn, error) {
	var row PurchaseReturn
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&row).Error
	return &row, err
}

func (r *Repository) FindPurchaseReturnForUpdate(tx *gorm.DB, id, businessID string) (*PurchaseReturn, error) {
	var row PurchaseReturn
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		First(&row).Error
	return &row, err
}

func (r *Repository) ListPurchaseReturns(businessID string, query PurchaseReturnListQuery) ([]PurchaseReturn, int64, error) {
	db := r.db.Model(&PurchaseReturn{}).Where("purchase_returns.business_id = ? AND purchase_returns.deleted_at IS NULL", businessID)
	db = applyReturnFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []PurchaseReturn
	err := db.Order(fmt.Sprintf("purchase_returns.%s %s", safeReturnSort(query.SortBy), safeOrder(query.SortOrder))).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) PurchaseReturnItems(returnID, businessID string) ([]PurchaseReturnItem, error) {
	var items []PurchaseReturnItem
	err := r.db.Where("purchase_return_id = ? AND business_id = ? AND deleted_at IS NULL", returnID, businessID).
		Order("created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *Repository) PurchaseReturnItemsForUpdate(tx *gorm.DB, returnID, businessID string) ([]PurchaseReturnItem, error) {
	var items []PurchaseReturnItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("purchase_return_id = ? AND business_id = ? AND deleted_at IS NULL", returnID, businessID).
		Order("created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *Repository) PurchaseReturnsForReceipt(businessID, receiptID string) ([]PurchaseReturn, error) {
	var rows []PurchaseReturn
	err := r.db.Where("business_id = ? AND purchase_receipt_id = ? AND deleted_at IS NULL", businessID, receiptID).
		Order("return_date ASC, created_at ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) PurchaseReturnsForInvoice(businessID, invoiceID string) ([]PurchaseReturn, error) {
	var rows []PurchaseReturn
	err := r.db.Where("business_id = ? AND purchase_invoice_id = ? AND deleted_at IS NULL", businessID, invoiceID).
		Order("return_date ASC, created_at ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) PurchaseReturnsForOrder(businessID, orderID string) ([]PurchaseReturn, error) {
	var rows []PurchaseReturn
	err := r.db.Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Order("return_date ASC, created_at ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) PostedReturnedQuantityForReceiptItem(tx *gorm.DB, businessID, receiptItemID, excludeReturnID string) (float64, error) {
	db := tx.Table("purchase_return_items pri").
		Select("COALESCE(SUM(pri.quantity), 0)").
		Joins("JOIN purchase_returns pr ON pr.id = pri.purchase_return_id AND pr.business_id = pri.business_id").
		Where("pri.business_id = ? AND pri.purchase_receipt_item_id = ? AND pr.status = ? AND pri.deleted_at IS NULL AND pr.deleted_at IS NULL", businessID, receiptItemID, "posted")
	if strings.TrimSpace(excludeReturnID) != "" {
		db = db.Where("pr.id <> ?", excludeReturnID)
	}
	var quantity float64
	err := db.Scan(&quantity).Error
	return quantity, err
}

func (r *Repository) UpdatePurchaseReturnItemStockMovement(tx *gorm.DB, itemID, businessID, stockMovementID string) error {
	return updateOne(tx.Model(&PurchaseReturnItem{}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", itemID, businessID).
		Updates(map[string]interface{}{"stock_movement_id": stockMovementID, "updated_at": time.Now().UTC()}))
}

func (r *Repository) StockLocationName(stockLocationID *string, businessID string) string {
	if stockLocationID == nil || strings.TrimSpace(*stockLocationID) == "" {
		return ""
	}
	var name string
	_ = r.db.Table("stock_locations").Select("location_name").Where("id = ? AND business_id = ?", *stockLocationID, businessID).Scan(&name).Error
	return name
}

func (r *Repository) NextNumber(tx *gorm.DB, businessID, table, column, prefix, lockName string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+lockName).Error; err != nil {
		return "", err
	}
	var count int64
	if err := tx.Table(table).Where("business_id = ?", businessID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%06d", prefix, count+1), nil
}

func (r *Repository) ValidateBranch(tx *gorm.DB, businessID, branchID string) error {
	return exists(tx.Table("branches").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", branchID, businessID, "active"))
}

func (r *Repository) ValidateSupplier(tx *gorm.DB, businessID, branchID, supplierID string) error {
	return exists(tx.Table("suppliers").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", supplierID, businessID, branchID, "active"))
}

func (r *Repository) ValidateUnit(tx *gorm.DB, businessID, unitID string) error {
	return exists(tx.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND status = ? AND deleted_at IS NULL", unitID, businessID, "active"))
}

func (r *Repository) TaxRate(tx *gorm.DB, businessID, taxRateID string) (*TaxRateInfo, error) {
	var tax TaxRateInfo
	err := tx.Table("tax_rates").Select("id, tax_name, rate_percentage, is_inclusive").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", taxRateID, businessID, "active").Take(&tax).Error
	return &tax, err
}

func (r *Repository) PaymentMethod(tx *gorm.DB, businessID, methodID string) (*PaymentMethodInfo, error) {
	var method PaymentMethodInfo
	err := tx.Table("payment_methods").
		Select("id, method_name, method_type, requires_reference, show_in_purchasing").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", methodID, businessID, "active").
		Take(&method).Error
	return &method, err
}

func (r *Repository) Product(tx *gorm.DB, businessID, branchID, productID string) (*ProductInfo, error) {
	var product ProductInfo
	err := tx.Table("products").
		Select("id, product_name, unit_id, product_type, is_stock_tracked, is_expiry_tracked").
		Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", productID, businessID, branchID, "active").
		Take(&product).Error
	return &product, err
}

func (r *Repository) PackagingItem(tx *gorm.DB, businessID, branchID, packagingID string) (*PackagingInfo, error) {
	var item PackagingInfo
	err := tx.Table("packaging_items").Select("id, packaging_name, unit_id, is_stock_tracked").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", packagingID, businessID, branchID).Take(&item).Error
	return &item, err
}

func (r *Repository) IngredientItem(tx *gorm.DB, businessID, branchID, ingredientID string) (*IngredientInfo, error) {
	var item IngredientInfo
	err := tx.Table("ingredients").Select("id, ingredient_name, unit_id, is_stock_tracked, is_expiry_tracked").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", ingredientID, businessID, branchID, "active").Take(&item).Error
	return &item, err
}

func (r *Repository) UnitSymbol(unitID string) string {
	var symbol string
	_ = r.db.Table("units").Select("symbol").Where("id = ?", unitID).Scan(&symbol).Error
	return symbol
}

func (r *Repository) Summary(businessID, branchID string) (*PurchasingSummaryResponse, error) {
	var response PurchasingSummaryResponse
	orderDB := r.db.Model(&PurchaseOrder{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	openOrderDB := r.db.Model(&PurchaseOrder{}).Where("business_id = ? AND status IN ? AND deleted_at IS NULL", businessID, []string{"draft", "ordered", "partially_received"})
	invoiceDB := r.db.Model(&PurchaseInvoice{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	unpaidInvoiceDB := r.db.Model(&PurchaseInvoice{}).Select("COALESCE(SUM(balance_amount), 0)").Where("business_id = ? AND payment_status IN ? AND status <> ? AND deleted_at IS NULL", businessID, []string{"unpaid", "partial", "overdue"}, "cancelled")
	purchasesMonthDB := r.db.Model(&PurchaseInvoice{}).Select("COALESCE(SUM(total_amount), 0)").Where("business_id = ? AND status <> ? AND deleted_at IS NULL", businessID, "cancelled")
	receivedMonthDB := r.db.Model(&PurchaseReceiptItem{}).Select("COALESCE(SUM(quantity_received), 0)").Joins("JOIN purchase_receipts pr ON pr.id = purchase_receipt_items.purchase_receipt_id").Where("purchase_receipt_items.business_id = ? AND pr.status = ? AND purchase_receipt_items.deleted_at IS NULL", businessID, "posted")
	if strings.TrimSpace(branchID) != "" {
		orderDB = orderDB.Where("branch_id = ?", branchID)
		openOrderDB = openOrderDB.Where("branch_id = ?", branchID)
		invoiceDB = invoiceDB.Where("branch_id = ?", branchID)
		unpaidInvoiceDB = unpaidInvoiceDB.Where("branch_id = ?", branchID)
		purchasesMonthDB = purchasesMonthDB.Where("branch_id = ?", branchID)
		receivedMonthDB = receivedMonthDB.Where("pr.branch_id = ?", branchID)
	}
	_ = orderDB.Count(&response.TotalPurchaseOrders).Error
	_ = openOrderDB.Count(&response.OpenPurchaseOrders).Error
	_ = invoiceDB.Count(&response.TotalInvoices).Error
	_ = unpaidInvoiceDB.Scan(&response.UnpaidInvoiceAmount).Error
	start := time.Now().UTC().AddDate(0, 0, -time.Now().UTC().Day()+1)
	_ = purchasesMonthDB.Where("invoice_date >= ?", start).Scan(&response.PurchasesThisMonth).Error
	_ = receivedMonthDB.Where("pr.received_date >= ?", start).Scan(&response.ReceivedThisMonth).Error
	response.UnpaidInvoiceAmount = roundMoney(response.UnpaidInvoiceAmount)
	response.PurchasesThisMonth = roundMoney(response.PurchasesThisMonth)
	response.ReceivedThisMonth = roundQuantity(response.ReceivedThisMonth)
	return &response, nil
}

func (r *Repository) NameLookups(businessID, branchID, supplierID string) (string, string) {
	var branchName, supplierName string
	_ = r.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", branchID, businessID).Scan(&branchName).Error
	_ = r.db.Table("suppliers").Select("supplier_name").Where("id = ? AND business_id = ? AND branch_id = ?", supplierID, businessID, branchID).Scan(&supplierName).Error
	return branchName, supplierName
}

func applyCommonFilters(db *gorm.DB, table string, query ListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where(table+".branch_id = ?", query.BranchID)
	}
	if query.SupplierID != "" {
		db = db.Where(table+".supplier_id = ?", query.SupplierID)
	}
	if query.Status != "" {
		db = db.Where(table+".status = ?", query.Status)
	}
	if query.DateFrom != "" {
		db = db.Where(table+".created_at >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where(table+".created_at <= ?", query.DateTo)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		switch table {
		case "purchase_orders":
			db = db.Where("LOWER(purchase_orders.purchase_order_number) LIKE ? OR LOWER(purchase_orders.notes) LIKE ?", like, like)
		case "purchase_invoices":
			db = db.Where("LOWER(purchase_invoices.invoice_number) LIKE ? OR LOWER(purchase_invoices.notes) LIKE ?", like, like)
		case "purchase_receipts":
			db = db.Where("LOWER(purchase_receipts.receipt_number) LIKE ? OR LOWER(purchase_receipts.notes) LIKE ?", like, like)
		}
	}
	return db
}

func applyPaymentFilters(db *gorm.DB, query PaymentListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("pip.branch_id = ?", query.BranchID)
	}
	if query.SupplierID != "" {
		db = db.Where("pip.supplier_id = ?", query.SupplierID)
	}
	if query.InvoiceID != "" {
		db = db.Where("pip.purchase_invoice_id = ?", query.InvoiceID)
	}
	if query.PaymentMethodID != "" {
		db = db.Where("pip.payment_method_id = ?", query.PaymentMethodID)
	}
	if query.PaymentStatus != "" {
		db = db.Where("pip.payment_status = ?", query.PaymentStatus)
	}
	if query.PaidByUserID != "" {
		db = db.Where("pip.paid_by_user_id = ?", query.PaidByUserID)
	}
	if query.DateFrom != "" {
		db = db.Where("pip.paid_at >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("pip.paid_at <= ?", query.DateTo)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(pi.invoice_number) LIKE ? OR LOWER(s.supplier_name) LIKE ? OR LOWER(pip.reference_number) LIKE ? OR LOWER(pip.payment_method_name_snapshot) LIKE ? OR LOWER(pip.notes) LIKE ?", like, like, like, like, like)
	}
	return db
}

func applyReturnFilters(db *gorm.DB, query PurchaseReturnListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("purchase_returns.branch_id = ?", query.BranchID)
	}
	if query.SupplierID != "" {
		db = db.Where("purchase_returns.supplier_id = ?", query.SupplierID)
	}
	if query.PurchaseInvoiceID != "" {
		db = db.Where("purchase_returns.purchase_invoice_id = ?", query.PurchaseInvoiceID)
	}
	if query.PurchaseReceiptID != "" {
		db = db.Where("purchase_returns.purchase_receipt_id = ?", query.PurchaseReceiptID)
	}
	if query.Status != "" {
		db = db.Where("purchase_returns.status = ?", query.Status)
	}
	if query.DateFrom != "" {
		db = db.Where("purchase_returns.return_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("purchase_returns.return_date <= ?", query.DateTo)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(purchase_returns.return_number) LIKE ? OR LOWER(purchase_returns.supplier_reference_number) LIKE ? OR LOWER(purchase_returns.reason) LIKE ?", like, like, like)
	}
	return db
}

func safeSort(value string) string {
	switch value {
	case "updated_at", "status", "total_amount", "invoice_date", "order_date", "received_date":
		return value
	default:
		return "created_at"
	}
}

func safeReturnSort(value string) string {
	switch value {
	case "return_date", "return_total", "status", "created_at", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func safePaymentSort(value string) string {
	switch value {
	case "paid_at", "amount", "payment_status", "created_at", "updated_at":
		return value
	default:
		return "paid_at"
	}
}

func safeOrder(value string) string {
	if strings.ToLower(value) == "asc" {
		return "asc"
	}
	return "desc"
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

type TaxRateInfo struct {
	ID             string
	TaxName        string
	RatePercentage float64
	IsInclusive    bool
}

type PaymentMethodInfo struct {
	ID                string
	MethodName        string
	MethodType        string
	RequiresReference bool
	ShowInPurchasing  bool
}

type ProductInfo struct {
	ID              string
	ProductName     string
	UnitID          string
	ProductType     string
	IsStockTracked  bool
	IsExpiryTracked bool
}

type PackagingInfo struct {
	ID             string
	PackagingName  string
	UnitID         string
	IsStockTracked bool
}

type IngredientInfo struct {
	ID              string
	IngredientName  string
	UnitID          string
	IsStockTracked  bool
	IsExpiryTracked bool
}
