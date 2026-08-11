package purchasing

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

type supplierPaymentResponseRow struct {
	ID                     string    `json:"id"`
	BusinessID             string    `json:"business_id"`
	BranchID               string    `json:"branch_id"`
	BranchName             string    `json:"branch_name"`
	SupplierID             string    `json:"supplier_id"`
	SupplierName           string    `json:"supplier_name"`
	PaymentMethodID        string    `json:"payment_method_id"`
	PaymentMethodName      string    `json:"payment_method_name"`
	PaymentMethodType      string    `json:"payment_method_type"`
	PaidThroughAccountID   string    `json:"paid_through_account_id"`
	PaidThroughAccountName string    `json:"paid_through_account_name"`
	Amount                 float64   `json:"amount"`
	AllocatedAmount        float64   `json:"allocated_amount"`
	UnappliedAmount        float64   `json:"unapplied_amount"`
	ReferenceNumber        string    `json:"reference_number"`
	PaymentDate            time.Time `json:"payment_date"`
	Status                 string    `json:"status"`
	Notes                  string    `json:"notes"`
	JournalEntryID         *string   `json:"journal_entry_id"`
	PaidByUserID           string    `json:"paid_by_user_id"`
	PaidByUserName         string    `json:"paid_by_user_name"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

func (row supplierPaymentResponseRow) toResponse() SupplierPaymentResponse {
	return SupplierPaymentResponse{
		ID:                     row.ID,
		BusinessID:             row.BusinessID,
		BranchID:               row.BranchID,
		BranchName:             row.BranchName,
		SupplierID:             row.SupplierID,
		SupplierName:           row.SupplierName,
		PaymentMethodID:        row.PaymentMethodID,
		PaymentMethodName:      row.PaymentMethodName,
		PaymentMethodType:      row.PaymentMethodType,
		PaidThroughAccountID:   row.PaidThroughAccountID,
		PaidThroughAccountName: row.PaidThroughAccountName,
		Amount:                 row.Amount,
		AllocatedAmount:        row.AllocatedAmount,
		UnappliedAmount:        row.UnappliedAmount,
		ReferenceNumber:        row.ReferenceNumber,
		PaymentDate:            row.PaymentDate,
		Status:                 row.Status,
		Notes:                  row.Notes,
		JournalEntryID:         row.JournalEntryID,
		PaidByUserID:           row.PaidByUserID,
		PaidByUserName:         row.PaidByUserName,
		CreatedAt:              row.CreatedAt,
		UpdatedAt:              row.UpdatedAt,
	}
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateOrderRevision(tx *gorm.DB, revision *PurchaseOrderRevision) error {
	return tx.Create(revision).Error
}

func (r *Repository) NextOrderRevisionNumber(tx *gorm.DB, businessID, orderID string) (int, error) {
	var maxRevision int
	err := tx.Model(&PurchaseOrderRevision{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Select("COALESCE(MAX(revision_number), 0)").
		Scan(&maxRevision).Error
	return maxRevision + 1, err
}

func (r *Repository) PurchaseOrderRevisionImpactCounts(tx *gorm.DB, businessID, orderID string) (PurchaseOrderRevisionImpactResponse, error) {
	var impact PurchaseOrderRevisionImpactResponse
	if err := tx.Model(&PurchaseReceipt{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL AND status = ?", businessID, orderID, "posted").
		Count(&impact.PostedReceiptCount).Error; err != nil {
		return impact, err
	}
	if err := tx.Model(&PurchaseInvoice{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL AND status = ?", businessID, orderID, "posted").
		Count(&impact.PostedInvoiceCount).Error; err != nil {
		return impact, err
	}
	if err := tx.Model(&PurchaseReturn{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL AND status IN ?", businessID, orderID, []string{"posted", "reversed"}).
		Count(&impact.VendorCreditCount).Error; err != nil {
		return impact, err
	}
	if err := tx.Table("supplier_payment_allocations spa").
		Joins("JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id AND pi.deleted_at IS NULL").
		Where("spa.business_id = ? AND pi.purchase_order_id = ? AND spa.deleted_at IS NULL", businessID, orderID).
		Count(&impact.SupplierPaymentCount).Error; err != nil {
		return impact, err
	}
	if err := tx.Table("stock_movements sm").
		Where(`
			sm.business_id = ?
			AND sm.reference_id IS NOT NULL
			AND (
				sm.reference_id = ?
				OR EXISTS (
					SELECT 1 FROM purchase_receipts pr
					WHERE pr.id = sm.reference_id
						AND pr.business_id = sm.business_id
						AND pr.purchase_order_id = ?
						AND pr.deleted_at IS NULL
				)
				OR EXISTS (
					SELECT 1 FROM purchase_returns prt
					WHERE prt.id = sm.reference_id
						AND prt.business_id = sm.business_id
						AND prt.purchase_order_id = ?
						AND prt.deleted_at IS NULL
				)
			)
		`, businessID, orderID, orderID, orderID).
		Count(&impact.StockMovementCount).Error; err != nil {
		return impact, err
	}
	impact.HasFinalizedHistory = impact.PostedReceiptCount > 0 || impact.PostedInvoiceCount > 0 || impact.SupplierPaymentCount > 0 || impact.StockMovementCount > 0 || impact.VendorCreditCount > 0
	return impact, nil
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

func (r *Repository) PurchaseOrderHistoryCount(tx *gorm.DB, businessID, orderID string) (int64, error) {
	var count int64
	if err := tx.Model(&PurchaseInvoice{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total := count
	if err := tx.Model(&PurchaseReceipt{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count
	if err := tx.Model(&PurchaseReturn{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL", businessID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count
	if err := tx.Table("purchase_invoice_payments pip").
		Joins("JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id AND pi.business_id = pip.business_id AND pi.deleted_at IS NULL").
		Where("pip.business_id = ? AND pi.purchase_order_id = ? AND pip.deleted_at IS NULL AND pip.supplier_payment_id IS NULL", businessID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count
	if err := tx.Table("supplier_payment_allocations spa").
		Joins("JOIN supplier_payments sp ON sp.id = spa.supplier_payment_id AND sp.business_id = spa.business_id AND sp.deleted_at IS NULL").
		Joins("JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id AND pi.deleted_at IS NULL").
		Where("spa.business_id = ? AND pi.purchase_order_id = ? AND spa.deleted_at IS NULL", businessID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count
	if err := tx.Table("stock_movements sm").
		Where(`
			sm.business_id = ?
			AND (
				sm.reference_id = ?
				OR EXISTS (
					SELECT 1
					FROM purchase_receipts pr
					WHERE pr.id = sm.reference_id
						AND pr.business_id = sm.business_id
						AND pr.purchase_order_id = ?
						AND pr.deleted_at IS NULL
				)
			)
		`, businessID, orderID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count
	return total, nil
}

func (r *Repository) FinalizedPurchaseOrderHistoryCount(tx *gorm.DB, businessID, orderID string) (int64, error) {
	var count int64
	var total int64

	if err := tx.Model(&PurchaseInvoice{}).
		Where(`business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL AND (
			status = ?
			OR journal_entry_id IS NOT NULL
			OR reversal_journal_entry_id IS NOT NULL
			OR cancelled_receipt_id IS NOT NULL
		)`, businessID, orderID, "posted").
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	if err := tx.Model(&PurchaseReceipt{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL AND (status = ? OR journal_entry_id IS NOT NULL)", businessID, orderID, "posted").
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	if err := tx.Model(&PurchaseReturn{}).
		Where("business_id = ? AND purchase_order_id = ? AND deleted_at IS NULL AND (status IN ? OR journal_entry_id IS NOT NULL)", businessID, orderID, []string{"posted", "reversed"}).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	if err := tx.Table("purchase_invoice_payments pip").
		Joins("JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id AND pi.business_id = pip.business_id AND pi.deleted_at IS NULL").
		Where("pip.business_id = ? AND pi.purchase_order_id = ? AND pip.deleted_at IS NULL AND pip.payment_status = ?", businessID, orderID, "completed").
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	if err := tx.Table("supplier_payment_allocations spa").
		Joins("JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id AND pi.deleted_at IS NULL").
		Where("spa.business_id = ? AND pi.purchase_order_id = ? AND spa.deleted_at IS NULL", businessID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	if err := tx.Table("stock_movements sm").
		Where(`
			sm.business_id = ?
			AND sm.reference_id IS NOT NULL
			AND (
				sm.reference_id = ?
				OR EXISTS (
					SELECT 1
					FROM purchase_receipts pr
					WHERE pr.id = sm.reference_id
						AND pr.business_id = sm.business_id
						AND pr.purchase_order_id = ?
						AND pr.deleted_at IS NULL
				)
				OR EXISTS (
					SELECT 1
					FROM purchase_returns prt
					WHERE prt.id = sm.reference_id
						AND prt.business_id = sm.business_id
						AND prt.purchase_order_id = ?
						AND prt.deleted_at IS NULL
				)
			)
		`, businessID, orderID, orderID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	if err := tx.Table("stock_movements sm").
		Where(`
			sm.business_id = ?
			AND sm.accounting_journal_entry_id IS NOT NULL
			AND sm.reference_id IS NOT NULL
			AND (
				sm.reference_id = ?
				OR EXISTS (
					SELECT 1
					FROM purchase_receipts pr
					WHERE pr.id = sm.reference_id
						AND pr.business_id = sm.business_id
						AND pr.purchase_order_id = ?
						AND pr.deleted_at IS NULL
				)
				OR EXISTS (
					SELECT 1
					FROM purchase_returns prt
					WHERE prt.id = sm.reference_id
						AND prt.business_id = sm.business_id
						AND prt.purchase_order_id = ?
						AND prt.deleted_at IS NULL
				)
			)
		`, businessID, orderID, orderID, orderID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	total += count

	return total, nil
}

func (r *Repository) HardDeleteOrder(tx *gorm.DB, businessID, orderID string) error {
	returnIDs, err := r.purchaseOrderDraftReturnIDs(tx, businessID, orderID)
	if err != nil {
		return err
	}
	receiptIDs, err := r.purchaseOrderDraftReceiptIDs(tx, businessID, orderID)
	if err != nil {
		return err
	}
	invoiceIDs, err := r.purchaseOrderDraftInvoiceIDs(tx, businessID, orderID)
	if err != nil {
		return err
	}

	if err := r.hardDeleteDocumentChargesForIDs(tx, businessID, "purchase_return", returnIDs); err != nil {
		return err
	}
	if len(returnIDs) > 0 {
		if err := tx.Unscoped().Where("purchase_return_id IN ? AND business_id = ?", returnIDs, businessID).Delete(&PurchaseReturnItem{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("id IN ? AND business_id = ?", returnIDs, businessID).Delete(&PurchaseReturn{}).Error; err != nil {
			return err
		}
	}

	if err := r.hardDeleteDocumentChargesForIDs(tx, businessID, "purchase_receipt", receiptIDs); err != nil {
		return err
	}
	if len(receiptIDs) > 0 {
		if err := tx.Unscoped().Where("purchase_receipt_id IN ? AND business_id = ?", receiptIDs, businessID).Delete(&PurchaseReceiptItem{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("id IN ? AND business_id = ?", receiptIDs, businessID).Delete(&PurchaseReceipt{}).Error; err != nil {
			return err
		}
	}

	if err := r.hardDeleteDocumentChargesForIDs(tx, businessID, "purchase_invoice", invoiceIDs); err != nil {
		return err
	}
	if len(invoiceIDs) > 0 {
		if err := tx.Unscoped().Where("purchase_invoice_id IN ? AND business_id = ?", invoiceIDs, businessID).Delete(&PurchaseInvoiceItem{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("id IN ? AND business_id = ?", invoiceIDs, businessID).Delete(&PurchaseInvoice{}).Error; err != nil {
			return err
		}
	}

	if err := tx.Exec("DELETE FROM document_charges WHERE business_id = ? AND document_type = ? AND document_id = ?", businessID, "purchase_order", orderID).Error; err != nil {
		return err
	}
	if err := tx.Unscoped().
		Where("purchase_order_id = ? AND business_id = ?", orderID, businessID).
		Delete(&PurchaseOrderItem{}).Error; err != nil {
		return err
	}
	return updateOne(tx.Unscoped().
		Where("id = ? AND business_id = ?", orderID, businessID).
		Delete(&PurchaseOrder{}))
}

func (r *Repository) purchaseOrderDraftInvoiceIDs(tx *gorm.DB, businessID, orderID string) ([]string, error) {
	var ids []string
	err := tx.Model(&PurchaseInvoice{}).
		Where("business_id = ? AND purchase_order_id = ? AND status IN ? AND deleted_at IS NULL", businessID, orderID, []string{"draft", "cancelled"}).
		Pluck("id", &ids).Error
	return ids, err
}

func (r *Repository) purchaseOrderDraftReceiptIDs(tx *gorm.DB, businessID, orderID string) ([]string, error) {
	var ids []string
	err := tx.Model(&PurchaseReceipt{}).
		Where("business_id = ? AND purchase_order_id = ? AND status IN ? AND deleted_at IS NULL", businessID, orderID, []string{"draft", "cancelled"}).
		Pluck("id", &ids).Error
	return ids, err
}

func (r *Repository) purchaseOrderDraftReturnIDs(tx *gorm.DB, businessID, orderID string) ([]string, error) {
	var ids []string
	err := tx.Table("purchase_returns prt").
		Joins("LEFT JOIN purchase_receipts pr ON pr.id = prt.purchase_receipt_id AND pr.business_id = prt.business_id AND pr.deleted_at IS NULL").
		Joins("LEFT JOIN purchase_invoices pi ON pi.id = prt.purchase_invoice_id AND pi.business_id = prt.business_id AND pi.deleted_at IS NULL").
		Where(`
			prt.business_id = ?
			AND prt.status IN ?
			AND prt.deleted_at IS NULL
			AND (
				prt.purchase_order_id = ?
				OR pr.purchase_order_id = ?
				OR pi.purchase_order_id = ?
			)
		`, businessID, []string{"draft", "cancelled"}, orderID, orderID, orderID).
		Pluck("prt.id", &ids).Error
	return ids, err
}

func (r *Repository) hardDeleteDocumentChargesForIDs(tx *gorm.DB, businessID, documentType string, documentIDs []string) error {
	if len(documentIDs) == 0 {
		return nil
	}
	return tx.Exec("DELETE FROM document_charges WHERE business_id = ? AND document_type = ? AND document_id IN ?", businessID, documentType, documentIDs).Error
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

func (r *Repository) UpdateOrderItem(tx *gorm.DB, itemID, businessID string, updates map[string]interface{}) error {
	return updateOne(tx.Model(&PurchaseOrderItem{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", itemID, businessID).Updates(updates))
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

func (r *Repository) InvoiceItemsForUpdate(tx *gorm.DB, invoiceID, businessID string) ([]PurchaseInvoiceItem, error) {
	var items []PurchaseInvoiceItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("purchase_invoice_id = ? AND business_id = ? AND deleted_at IS NULL", invoiceID, businessID).
		Order("created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *Repository) ActiveInvoiceCountForOrder(tx *gorm.DB, businessID, orderID string) (int64, error) {
	return r.ActiveInvoiceCountForOrderExcluding(tx, businessID, orderID, "")
}

func (r *Repository) ActiveInvoiceCountForOrderExcluding(tx *gorm.DB, businessID, orderID, excludeInvoiceID string) (int64, error) {
	var count int64
	query := tx.Model(&PurchaseInvoice{}).
		Where("business_id = ? AND purchase_order_id = ? AND status <> ? AND deleted_at IS NULL", businessID, orderID, "cancelled")
	if strings.TrimSpace(excludeInvoiceID) != "" {
		query = query.Where("id <> ?", excludeInvoiceID)
	}
	err := query.Count(&count).Error
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

func (r *Repository) CreateSupplierPayment(tx *gorm.DB, payment *SupplierPayment, allocations []SupplierPaymentAllocation) error {
	if err := tx.Create(payment).Error; err != nil {
		return err
	}
	if len(allocations) > 0 {
		return tx.Create(&allocations).Error
	}
	return nil
}

func (r *Repository) UpdateSupplierPayment(tx *gorm.DB, payment *SupplierPayment, allocations []SupplierPaymentAllocation) error {
	if err := tx.Save(payment).Error; err != nil {
		return err
	}
	if len(allocations) > 0 {
		return tx.Create(&allocations).Error
	}
	return nil
}

func (r *Repository) FindSupplierPayment(id, businessID string) (*SupplierPayment, error) {
	var payment SupplierPayment
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&payment).Error
	return &payment, err
}

func (r *Repository) FindSupplierPaymentForUpdate(tx *gorm.DB, id, businessID string) (*SupplierPayment, error) {
	var payment SupplierPayment
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).
		First(&payment).Error
	return &payment, err
}

func (r *Repository) SupplierPaymentAllocationsForUpdate(tx *gorm.DB, businessID, supplierPaymentID string) ([]SupplierPaymentAllocation, error) {
	var allocations []SupplierPaymentAllocation
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("business_id = ? AND supplier_payment_id = ? AND deleted_at IS NULL", businessID, supplierPaymentID).
		Order("created_at ASC").
		Find(&allocations).Error
	return allocations, err
}

func (r *Repository) HardDeleteSupplierPaymentAllocations(tx *gorm.DB, businessID, supplierPaymentID string) error {
	return tx.Unscoped().
		Where("business_id = ? AND supplier_payment_id = ?", businessID, supplierPaymentID).
		Delete(&SupplierPaymentAllocation{}).Error
}

func (r *Repository) HardDeleteSupplierPayment(tx *gorm.DB, businessID, supplierPaymentID string) error {
	if err := tx.Unscoped().
		Where("business_id = ? AND supplier_payment_id = ?", businessID, supplierPaymentID).
		Delete(&PurchaseInvoicePayment{}).Error; err != nil {
		return err
	}
	if err := r.HardDeleteSupplierPaymentAllocations(tx, businessID, supplierPaymentID); err != nil {
		return err
	}
	result := tx.Unscoped().
		Where("business_id = ? AND id = ?", businessID, supplierPaymentID).
		Delete(&SupplierPayment{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) HardDeleteSupplierPaymentJournal(tx *gorm.DB, businessID, supplierPaymentID string) error {
	var journalIDs []string
	if err := tx.Table("journal_entries").
		Where("business_id = ? AND source_type = ? AND source_id = ? AND deleted_at IS NULL", businessID, "supplier_payment", supplierPaymentID).
		Pluck("id", &journalIDs).Error; err != nil {
		return err
	}
	if len(journalIDs) == 0 {
		return nil
	}
	if err := tx.Unscoped().
		Where("business_id = ? AND journal_entry_id IN ?", businessID, journalIDs).
		Delete(&accounting.JournalEntryLine{}).Error; err != nil {
		return err
	}
	return tx.Unscoped().
		Where("business_id = ? AND id IN ?", businessID, journalIDs).
		Delete(&accounting.JournalEntry{}).Error
}

func (r *Repository) JournalEntryNumber(businessID string, journalEntryID *string) *string {
	if journalEntryID == nil || strings.TrimSpace(*journalEntryID) == "" {
		return nil
	}

	var row struct {
		EntryNumber string
	}
	if err := r.db.Table("journal_entries").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, strings.TrimSpace(*journalEntryID)).
		Select("entry_number").
		Take(&row).Error; err != nil {
		return nil
	}
	if strings.TrimSpace(row.EntryNumber) == "" {
		return nil
	}
	return &row.EntryNumber
}

func (r *Repository) ListSupplierPayments(businessID string, query PaymentListQuery) ([]SupplierPaymentResponse, int64, error) {
	db := r.db.Table("supplier_payments sp").
		Joins("JOIN suppliers s ON s.id = sp.supplier_id").
		Joins("JOIN branches b ON b.id = sp.branch_id").
		Joins("JOIN payment_accounts pa ON pa.id = sp.paid_through_account_id").
		Joins("LEFT JOIN users u ON u.id = sp.paid_by_user_id").
		Where("sp.business_id = ? AND sp.deleted_at IS NULL", businessID)
	db = applySupplierPaymentFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortBy := safeSupplierPaymentSort(query.SortBy)
	sortOrder := safeOrder(query.SortOrder)
	var rows []supplierPaymentResponseRow
	err := db.Select(`sp.id, sp.business_id, sp.branch_id, b.branch_name, sp.supplier_id, s.supplier_name,
			sp.payment_method_id, sp.payment_method_name_snapshot AS payment_method_name,
			sp.payment_method_type_snapshot AS payment_method_type,
			sp.paid_through_account_id, pa.account_name AS paid_through_account_name,
			sp.amount, sp.allocated_amount, sp.unapplied_amount, sp.reference_number,
			sp.payment_date, sp.status, sp.notes, sp.journal_entry_id,
			sp.paid_by_user_id, COALESCE(u.full_name, '') AS paid_by_user_name,
			sp.created_at, sp.updated_at`).
		Order("sp." + sortBy + " " + sortOrder).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&rows).Error
	if err != nil {
		return nil, total, err
	}
	responses := make([]SupplierPaymentResponse, 0, len(rows))
	for _, row := range rows {
		responses = append(responses, row.toResponse())
	}
	return responses, total, nil
}

func (r *Repository) SupplierPaymentAllocations(businessID, supplierPaymentID string) ([]SupplierPaymentAllocationResponse, error) {
	var rows []SupplierPaymentAllocationResponse
	err := r.db.Table("supplier_payment_allocations spa").
		Select(`spa.id, spa.supplier_payment_id, spa.purchase_invoice_id, pi.invoice_number,
			spa.amount, spa.created_at, spa.updated_at`).
		Joins("JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id").
		Where("spa.business_id = ? AND spa.supplier_payment_id = ? AND spa.deleted_at IS NULL", businessID, supplierPaymentID).
		Order("pi.invoice_date ASC, spa.created_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) SupplierPaymentResponse(businessID, supplierPaymentID string) (*SupplierPaymentResponse, error) {
	var row supplierPaymentResponseRow
	err := r.db.Table("supplier_payments sp").
		Select(`sp.id, sp.business_id, sp.branch_id, b.branch_name, sp.supplier_id, s.supplier_name,
			sp.payment_method_id, sp.payment_method_name_snapshot AS payment_method_name,
			sp.payment_method_type_snapshot AS payment_method_type,
			sp.paid_through_account_id, pa.account_name AS paid_through_account_name,
			sp.amount, sp.allocated_amount, sp.unapplied_amount, sp.reference_number,
			sp.payment_date, sp.status, sp.notes, sp.journal_entry_id,
			sp.paid_by_user_id, COALESCE(u.full_name, '') AS paid_by_user_name,
			sp.created_at, sp.updated_at`).
		Joins("JOIN suppliers s ON s.id = sp.supplier_id").
		Joins("JOIN branches b ON b.id = sp.branch_id").
		Joins("JOIN payment_accounts pa ON pa.id = sp.paid_through_account_id").
		Joins("LEFT JOIN users u ON u.id = sp.paid_by_user_id").
		Where("sp.business_id = ? AND sp.id = ? AND sp.deleted_at IS NULL", businessID, supplierPaymentID).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.ID == "" {
		return nil, gorm.ErrRecordNotFound
	}
	response := row.toResponse()
	allocations, err := r.SupplierPaymentAllocations(businessID, supplierPaymentID)
	if err != nil {
		return nil, err
	}
	response.Allocations = allocations
	return &response, nil
}

func (r *Repository) ListInvoicePayments(businessID, invoiceID string) ([]PurchaseInvoicePaymentResponse, error) {
	var rows []PurchaseInvoicePaymentResponse
	err := r.db.Raw(`
		SELECT *
		FROM (
			SELECT
				sp.id AS payment_id,
				spa.purchase_invoice_id,
				pi.invoice_number,
				sp.supplier_id,
				s.supplier_name,
				sp.branch_id,
				b.branch_name,
				sp.payment_method_id,
				sp.payment_method_name_snapshot AS payment_method_name,
				sp.payment_method_type_snapshot AS payment_method_type,
				spa.amount,
				sp.status AS payment_status,
				sp.reference_number,
				sp.paid_by_user_id,
				COALESCE(u.full_name, '') AS paid_by_user_name,
				sp.payment_date AS paid_at,
				sp.notes,
				sp.journal_entry_id,
				sp.created_at,
				sp.updated_at
			FROM supplier_payment_allocations spa
			JOIN supplier_payments sp ON sp.id = spa.supplier_payment_id AND sp.business_id = spa.business_id
			JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id
			JOIN suppliers s ON s.id = sp.supplier_id
			JOIN branches b ON b.id = sp.branch_id
			LEFT JOIN users u ON u.id = sp.paid_by_user_id
			WHERE spa.business_id = ? AND spa.purchase_invoice_id = ?
				AND spa.deleted_at IS NULL AND sp.deleted_at IS NULL

			UNION ALL

			SELECT
				pip.id AS payment_id,
				pip.purchase_invoice_id,
				pi.invoice_number,
				pip.supplier_id,
				s.supplier_name,
				pip.branch_id,
				b.branch_name,
				pip.payment_method_id,
				pip.payment_method_name_snapshot AS payment_method_name,
				pip.payment_method_type_snapshot AS payment_method_type,
				pip.amount,
				pip.payment_status,
				pip.reference_number,
				pip.paid_by_user_id,
				COALESCE(u.full_name, '') AS paid_by_user_name,
				pip.paid_at,
				pip.notes,
				pip.journal_entry_id,
				pip.created_at,
				pip.updated_at
			FROM purchase_invoice_payments pip
			JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id
			JOIN suppliers s ON s.id = pip.supplier_id
			JOIN branches b ON b.id = pip.branch_id
			LEFT JOIN users u ON u.id = pip.paid_by_user_id
			WHERE pip.business_id = ? AND pip.purchase_invoice_id = ?
				AND pip.deleted_at IS NULL AND pip.supplier_payment_id IS NULL
		) payments
		ORDER BY paid_at ASC, created_at ASC
	`, businessID, invoiceID, businessID, invoiceID).Scan(&rows).Error
	return rows, err
}

func (r *Repository) ListAllInvoicePayments(businessID string, query PaymentListQuery) ([]PurchaseInvoicePaymentResponse, int64, error) {
	baseSQL, args := invoicePaymentCompatibilitySQL(businessID, query)
	var total int64
	if err := r.db.Raw("SELECT COUNT(*) FROM ("+baseSQL+") payments", args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	sortBy := safePaymentSort(query.SortBy)
	sortOrder := safeOrder(query.SortOrder)
	var rows []PurchaseInvoicePaymentResponse
	args = append(args, query.Limit, (query.Page-1)*query.Limit)
	err := r.db.Raw("SELECT * FROM ("+baseSQL+") payments ORDER BY "+sortBy+" "+sortOrder+" LIMIT ? OFFSET ?", args...).Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) CompletedInvoicePaymentCount(tx *gorm.DB, businessID, invoiceID string) (int64, error) {
	var count int64
	err := tx.Raw(`
		SELECT COUNT(*)
		FROM (
			SELECT spa.id
			FROM supplier_payment_allocations spa
			JOIN supplier_payments sp ON sp.id = spa.supplier_payment_id AND sp.business_id = spa.business_id
			WHERE spa.business_id = ? AND spa.purchase_invoice_id = ?
				AND sp.status = 'completed'
				AND spa.deleted_at IS NULL AND sp.deleted_at IS NULL
			UNION ALL
			SELECT pip.id
			FROM purchase_invoice_payments pip
			WHERE pip.business_id = ? AND pip.purchase_invoice_id = ?
				AND pip.payment_status = 'completed'
				AND pip.deleted_at IS NULL AND pip.supplier_payment_id IS NULL
		) payments
	`, businessID, invoiceID, businessID, invoiceID).Scan(&count).Error
	return count, err
}

func (r *Repository) InvoicePaymentsForOrder(businessID, orderID string) ([]PurchaseInvoicePaymentResponse, error) {
	var rows []PurchaseInvoicePaymentResponse
	err := r.db.Raw(`
		SELECT *
		FROM (
			SELECT
				sp.id AS payment_id,
				spa.purchase_invoice_id,
				pi.invoice_number,
				sp.supplier_id,
				s.supplier_name,
				sp.branch_id,
				b.branch_name,
				sp.payment_method_id,
				sp.payment_method_name_snapshot AS payment_method_name,
				sp.payment_method_type_snapshot AS payment_method_type,
				spa.amount,
				sp.status AS payment_status,
				sp.reference_number,
				sp.paid_by_user_id,
				COALESCE(u.full_name, '') AS paid_by_user_name,
				sp.payment_date AS paid_at,
				sp.notes,
				sp.journal_entry_id,
				sp.created_at,
				sp.updated_at
			FROM supplier_payment_allocations spa
			JOIN supplier_payments sp ON sp.id = spa.supplier_payment_id AND sp.business_id = spa.business_id
			JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id AND pi.deleted_at IS NULL
			JOIN suppliers s ON s.id = sp.supplier_id
			JOIN branches b ON b.id = sp.branch_id
			LEFT JOIN users u ON u.id = sp.paid_by_user_id
			WHERE spa.business_id = ? AND pi.purchase_order_id = ?
				AND spa.deleted_at IS NULL AND sp.deleted_at IS NULL

			UNION ALL

			SELECT
				pip.id AS payment_id,
				pip.purchase_invoice_id,
				pi.invoice_number,
				pip.supplier_id,
				s.supplier_name,
				pip.branch_id,
				b.branch_name,
				pip.payment_method_id,
				pip.payment_method_name_snapshot AS payment_method_name,
				pip.payment_method_type_snapshot AS payment_method_type,
				pip.amount,
				pip.payment_status,
				pip.reference_number,
				pip.paid_by_user_id,
				COALESCE(u.full_name, '') AS paid_by_user_name,
				pip.paid_at,
				pip.notes,
				pip.journal_entry_id,
				pip.created_at,
				pip.updated_at
			FROM purchase_invoice_payments pip
			JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id AND pi.business_id = pip.business_id AND pi.deleted_at IS NULL
			JOIN suppliers s ON s.id = pip.supplier_id
			JOIN branches b ON b.id = pip.branch_id
			LEFT JOIN users u ON u.id = pip.paid_by_user_id
			WHERE pip.business_id = ? AND pi.purchase_order_id = ?
				AND pip.deleted_at IS NULL AND pip.supplier_payment_id IS NULL
		) payments
		ORDER BY paid_at ASC, created_at ASC
	`, businessID, orderID, businessID, orderID).Scan(&rows).Error
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
	err := r.db.Model(&PurchaseReceipt{}).
		Select("purchase_receipts.*, po.purchase_order_number AS purchase_order_number, pi.invoice_number AS purchase_invoice_number").
		Joins("LEFT JOIN purchase_orders po ON po.id = purchase_receipts.purchase_order_id AND po.business_id = purchase_receipts.business_id").
		Joins("LEFT JOIN purchase_invoices pi ON pi.id = purchase_receipts.purchase_invoice_id AND pi.business_id = purchase_receipts.business_id").
		Where("purchase_receipts.id = ? AND purchase_receipts.business_id = ? AND purchase_receipts.deleted_at IS NULL", id, businessID).
		First(&receipt).Error
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
	err := db.Select("purchase_receipts.*, po.purchase_order_number AS purchase_order_number, pi.invoice_number AS purchase_invoice_number").
		Joins("LEFT JOIN purchase_orders po ON po.id = purchase_receipts.purchase_order_id AND po.business_id = purchase_receipts.business_id").
		Joins("LEFT JOIN purchase_invoices pi ON pi.id = purchase_receipts.purchase_invoice_id AND pi.business_id = purchase_receipts.business_id").
		Order(fmt.Sprintf("purchase_receipts.%s %s", safeSort(query.SortBy), safeOrder(query.SortOrder))).
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

func (r *Repository) ReceiptsForInvoiceForUpdate(tx *gorm.DB, businessID, invoiceID string) ([]PurchaseReceipt, error) {
	var receipts []PurchaseReceipt
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("business_id = ? AND purchase_invoice_id = ? AND status <> ? AND deleted_at IS NULL", businessID, invoiceID, "cancelled").
		Order("received_date ASC, created_at ASC").
		Find(&receipts).Error
	return receipts, err
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

func (r *Repository) PostedReceiptItemsForInvoice(businessID, invoiceID string) ([]PurchaseReceiptItem, error) {
	var items []PurchaseReceiptItem
	err := r.db.Model(&PurchaseReceiptItem{}).
		Joins("JOIN purchase_receipts pr ON pr.id = purchase_receipt_items.purchase_receipt_id AND pr.business_id = purchase_receipt_items.business_id").
		Where("purchase_receipt_items.business_id = ? AND pr.purchase_invoice_id = ? AND pr.status = ? AND pr.deleted_at IS NULL AND purchase_receipt_items.deleted_at IS NULL", businessID, invoiceID, "posted").
		Order("purchase_receipt_items.created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *Repository) PostedReceiptItemsForInvoiceForUpdate(tx *gorm.DB, businessID, invoiceID string) ([]PurchaseReceiptItem, error) {
	var items []PurchaseReceiptItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Model(&PurchaseReceiptItem{}).
		Joins("JOIN purchase_receipts pr ON pr.id = purchase_receipt_items.purchase_receipt_id AND pr.business_id = purchase_receipt_items.business_id").
		Where("purchase_receipt_items.business_id = ? AND pr.purchase_invoice_id = ? AND pr.status = ? AND pr.deleted_at IS NULL AND purchase_receipt_items.deleted_at IS NULL", businessID, invoiceID, "posted").
		Order("purchase_receipt_items.created_at ASC").
		Find(&items).Error
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

func (r *Repository) PostedPurchaseReturnCountForInvoice(tx *gorm.DB, businessID, invoiceID string) (int64, error) {
	var count int64
	err := tx.Model(&PurchaseReturn{}).
		Where("business_id = ? AND purchase_invoice_id = ? AND status = ? AND deleted_at IS NULL", businessID, invoiceID, "posted").
		Count(&count).Error
	return count, err
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
	return utils.NextSequentialNumber(tx.Table(table).Where("business_id = ?", businessID), column, prefix+"-", 6)
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
		Select("id, method_name, method_type, requires_reference, show_in_purchasing, default_payment_account_id").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", methodID, businessID, "active").
		Take(&method).Error
	return &method, err
}

func (r *Repository) ListPurchasingPaymentMethods(businessID, branchID string) ([]PurchasingPaymentMethodResponse, error) {
	var rows []PurchasingPaymentMethodResponse
	err := r.withPurchasingReadyPaymentAccount(r.db.Table("payment_methods pm"), branchID).
		Select(`
			pm.id,
			pm.business_id,
			pm.method_name,
			pm.method_type,
			pm.is_default,
			pm.status,
			pm.show_in_pos,
			pm.show_in_bakery_orders,
			pm.show_in_purchasing,
			pm.show_in_expenses,
			pm.show_in_dashboard_collection,
			pm.allow_split_payment,
			pm.requires_reference,
			pa.id::text AS default_payment_account_id,
			pa.account_name AS default_payment_account_name,
			pa.branch_id,
			COALESCE(account_branch.branch_name, payment_branch.branch_name, '') AS branch_name,
			pm.created_at::text AS created_at,
			pm.updated_at::text AS updated_at
		`).
		Joins("LEFT JOIN branches account_branch ON account_branch.id = pa.branch_id AND account_branch.business_id = pm.business_id AND account_branch.deleted_at IS NULL").
		Joins("LEFT JOIN branches payment_branch ON payment_branch.id = ? AND payment_branch.business_id = pm.business_id AND payment_branch.deleted_at IS NULL", branchID).
		Where("pm.business_id = ? AND pm.status = ? AND pm.show_in_purchasing = ? AND pm.deleted_at IS NULL", businessID, "active", true).
		Order("pm.is_default DESC, pm.method_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) withPurchasingReadyPaymentAccount(db *gorm.DB, branchID string) *gorm.DB {
	return db.
		Joins("LEFT JOIN payment_method_account_mappings pmam ON pmam.payment_method_id = pm.id AND pmam.business_id = pm.business_id AND pmam.branch_id = ? AND pmam.status = ? AND pmam.deleted_at IS NULL", branchID, "active").
		Joins("JOIN payment_accounts pa ON pa.id = COALESCE(pmam.payment_account_id, pm.default_payment_account_id) AND pa.business_id = pm.business_id AND pa.status = ? AND pa.deleted_at IS NULL", "active").
		Joins("JOIN chart_of_accounts coa ON coa.id = pa.chart_account_id AND coa.business_id = pa.business_id AND coa.status = ? AND coa.deleted_at IS NULL", "active").
		Where("COALESCE(pmam.payment_account_id, pm.default_payment_account_id) IS NOT NULL").
		Where("(pa.branch_id IS NULL OR pa.branch_id = ?)", branchID)
}

func (r *Repository) PaymentMethodMappedAccount(tx *gorm.DB, businessID, branchID, methodID string) (*PaymentAccountInfo, error) {
	var account PaymentAccountInfo
	err := tx.Table("payment_method_account_mappings pmam").
		Select("pa.id, pa.branch_id, pa.account_name, pa.chart_account_id, pa.status").
		Joins("JOIN payment_accounts pa ON pa.id = pmam.payment_account_id AND pa.business_id = pmam.business_id AND pa.status = ? AND pa.deleted_at IS NULL", "active").
		Where("pmam.business_id = ? AND pmam.branch_id = ? AND pmam.payment_method_id = ? AND pmam.status = ? AND pmam.deleted_at IS NULL", businessID, branchID, methodID, "active").
		Take(&account).Error
	return &account, err
}

func (r *Repository) PaymentAccount(tx *gorm.DB, businessID, accountID string) (*PaymentAccountInfo, error) {
	var account PaymentAccountInfo
	err := tx.Table("payment_accounts").
		Select("id, branch_id, account_name, chart_account_id, status").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", accountID, businessID, "active").
		Take(&account).Error
	return &account, err
}

func (r *Repository) PaymentAccountCurrentBalance(tx *gorm.DB, businessID, chartAccountID string, branchID *string) (float64, error) {
	branchFilter := ""
	args := []interface{}{businessID, chartAccountID}
	if branchID != nil && strings.TrimSpace(*branchID) != "" {
		branchFilter = "AND je.branch_id = ?"
		args = append(args, strings.TrimSpace(*branchID))
	}
	var balance float64
	err := tx.Raw(`
		SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.account_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  `+branchFilter+`
	`, args...).Scan(&balance).Error
	return roundMoney(balance), err
}

func (r *Repository) Product(tx *gorm.DB, businessID, branchID, productID string) (*ProductInfo, error) {
	var product ProductInfo
	err := tx.Table("products").
		Select("id, product_name, unit_id, product_type, is_purchasable, is_stock_tracked, is_expiry_tracked").
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

func (r *Repository) Summary(businessID, branchID, timezone string) (*PurchasingSummaryResponse, error) {
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
	// "This month" means the month where the business is, not where the server
	// is. Computing it in UTC put late-evening activity in the wrong month for
	// any business ahead of UTC.
	start := monthStartIn(timezone)
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
			db = db.Where("LOWER(purchase_invoices.invoice_number) LIKE ? OR LOWER(purchase_invoices.supplier_bill_number) LIKE ? OR LOWER(purchase_invoices.notes) LIKE ?", like, like, like)
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

func invoicePaymentCompatibilitySQL(businessID string, query PaymentListQuery) (string, []interface{}) {
	args := []interface{}{businessID}
	conditions := []string{"business_id = ?"}
	if query.BranchID != "" {
		conditions = append(conditions, "branch_id = ?")
		args = append(args, query.BranchID)
	}
	if query.SupplierID != "" {
		conditions = append(conditions, "supplier_id = ?")
		args = append(args, query.SupplierID)
	}
	if query.InvoiceID != "" {
		conditions = append(conditions, "purchase_invoice_id = ?")
		args = append(args, query.InvoiceID)
	}
	if query.PaymentMethodID != "" {
		conditions = append(conditions, "payment_method_id = ?")
		args = append(args, query.PaymentMethodID)
	}
	if query.PaymentStatus != "" {
		conditions = append(conditions, "payment_status = ?")
		args = append(args, query.PaymentStatus)
	}
	if query.PaidByUserID != "" {
		conditions = append(conditions, "paid_by_user_id = ?")
		args = append(args, query.PaidByUserID)
	}
	if query.DateFrom != "" {
		conditions = append(conditions, "paid_at >= ?")
		args = append(args, query.DateFrom)
	}
	if query.DateTo != "" {
		conditions = append(conditions, "paid_at <= ?")
		args = append(args, query.DateTo)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		conditions = append(conditions, "(LOWER(invoice_number) LIKE ? OR LOWER(supplier_name) LIKE ? OR LOWER(reference_number) LIKE ? OR LOWER(payment_method_name) LIKE ? OR LOWER(notes) LIKE ?)")
		args = append(args, like, like, like, like, like)
	}
	sql := `
		SELECT *
		FROM (
			SELECT
				sp.id AS payment_id,
				spa.purchase_invoice_id,
				pi.invoice_number,
				sp.supplier_id,
				s.supplier_name,
				sp.branch_id,
				b.branch_name,
				sp.payment_method_id,
				sp.payment_method_name_snapshot AS payment_method_name,
				sp.payment_method_type_snapshot AS payment_method_type,
				spa.amount,
				sp.status AS payment_status,
				sp.reference_number,
				sp.paid_by_user_id,
				COALESCE(u.full_name, '') AS paid_by_user_name,
				sp.payment_date AS paid_at,
				sp.notes,
				sp.journal_entry_id,
				sp.created_at,
				sp.updated_at,
				sp.business_id
			FROM supplier_payment_allocations spa
			JOIN supplier_payments sp ON sp.id = spa.supplier_payment_id AND sp.business_id = spa.business_id
			JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id AND pi.business_id = spa.business_id
			JOIN suppliers s ON s.id = sp.supplier_id
			JOIN branches b ON b.id = sp.branch_id
			LEFT JOIN users u ON u.id = sp.paid_by_user_id
			WHERE spa.deleted_at IS NULL AND sp.deleted_at IS NULL

			UNION ALL

			SELECT
				pip.id AS payment_id,
				pip.purchase_invoice_id,
				pi.invoice_number,
				pip.supplier_id,
				s.supplier_name,
				pip.branch_id,
				b.branch_name,
				pip.payment_method_id,
				pip.payment_method_name_snapshot AS payment_method_name,
				pip.payment_method_type_snapshot AS payment_method_type,
				pip.amount,
				pip.payment_status,
				pip.reference_number,
				pip.paid_by_user_id,
				COALESCE(u.full_name, '') AS paid_by_user_name,
				pip.paid_at,
				pip.notes,
				pip.journal_entry_id,
				pip.created_at,
				pip.updated_at,
				pip.business_id
			FROM purchase_invoice_payments pip
			JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id
			JOIN suppliers s ON s.id = pip.supplier_id
			JOIN branches b ON b.id = pip.branch_id
			LEFT JOIN users u ON u.id = pip.paid_by_user_id
			WHERE pip.deleted_at IS NULL AND pip.supplier_payment_id IS NULL
		) compatibility_payments
		WHERE ` + strings.Join(conditions, " AND ")
	return sql, args
}

func applySupplierPaymentFilters(db *gorm.DB, query PaymentListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("sp.branch_id = ?", query.BranchID)
	}
	if query.SupplierID != "" {
		db = db.Where("sp.supplier_id = ?", query.SupplierID)
	}
	if query.PaymentMethodID != "" {
		db = db.Where("sp.payment_method_id = ?", query.PaymentMethodID)
	}
	if query.PaymentStatus != "" {
		db = db.Where("sp.status = ?", query.PaymentStatus)
	}
	if query.PaidByUserID != "" {
		db = db.Where("sp.paid_by_user_id = ?", query.PaidByUserID)
	}
	if query.DateFrom != "" {
		db = db.Where("sp.payment_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("sp.payment_date <= ?", query.DateTo)
	}
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(s.supplier_name) LIKE ? OR LOWER(sp.reference_number) LIKE ? OR LOWER(sp.payment_method_name_snapshot) LIKE ? OR LOWER(sp.notes) LIKE ?", like, like, like, like)
	}
	if query.InvoiceID != "" {
		db = db.Where(`EXISTS (
			SELECT 1
			FROM supplier_payment_allocations spa
			WHERE spa.supplier_payment_id = sp.id
				AND spa.purchase_invoice_id = ?
				AND spa.deleted_at IS NULL
		)`, query.InvoiceID)
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

func safeSupplierPaymentSort(value string) string {
	switch value {
	case "payment_date", "amount", "allocated_amount", "unapplied_amount", "status", "created_at", "updated_at":
		return value
	default:
		return "payment_date"
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
	ID                      string
	MethodName              string
	MethodType              string
	RequiresReference       bool
	ShowInPurchasing        bool
	DefaultPaymentAccountID *string
}

type PaymentAccountInfo struct {
	ID             string
	BranchID       *string
	AccountName    string
	ChartAccountID string
	Status         string
}

type ProductInfo struct {
	ID              string
	ProductName     string
	UnitID          string
	ProductType     string
	IsPurchasable   bool
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

// monthStartIn returns midnight on the first of the current month in the given
// timezone, expressed in UTC for comparison against stored timestamps.
func monthStartIn(timezone string) time.Time {
	location, err := time.LoadLocation(strings.TrimSpace(timezone))
	if err != nil || location == nil {
		location = time.UTC
	}
	now := time.Now().In(location)
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location).UTC()
}
