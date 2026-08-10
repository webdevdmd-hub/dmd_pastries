package suppliers

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

type supplierStatementRow struct {
	ID                string
	DocumentID        string
	DocumentNumber    string
	TransactionType   string
	TransactionDate   time.Time
	BranchID          string
	BranchName        string
	DebitAmount       float64
	CreditAmount      float64
	Status            string
	PaymentStatus     string
	ReferenceNumber   string
	Notes             string
	PurchaseOrderID   *string
	PurchaseInvoiceID *string
	PurchaseReceiptID *string
	PurchaseReturnID  *string
	PaymentID         *string
}

type supplierStatsRow struct {
	SupplierID           string
	TotalPurchaseOrders  int64
	TotalBills           int64
	TotalPurchaseAmount  float64
	SupplierPaymentsPaid float64
	InvoicePaymentsPaid  float64
	VendorCredits        float64
	LastPurchaseDate     *time.Time
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, supplier *Supplier) error {
	return tx.Create(supplier).Error
}

func (r *Repository) FindByID(id, businessID, branchID string) (*Supplier, error) {
	var supplier Supplier
	err := r.db.Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).First(&supplier).Error
	return &supplier, err
}

func (r *Repository) Update(tx *gorm.DB, id, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&Supplier{}).Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", id, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) List(businessID, branchID string, query SupplierListQuery) ([]Supplier, int64, error) {
	db := r.db.Model(&Supplier{}).Where("suppliers.business_id = ? AND suppliers.branch_id = ? AND suppliers.deleted_at IS NULL", businessID, branchID)
	db = applySupplierFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var suppliers []Supplier
	err := db.Order(fmt.Sprintf("suppliers.%s %s", safeSupplierSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&suppliers).Error
	return suppliers, total, err
}

func (r *Repository) Lookup(businessID, branchID string, query SupplierLookupQuery) ([]SupplierLookupItem, error) {
	db := r.db.Table("suppliers s").
		Select("s.id, s.supplier_code, s.supplier_name, s.phone, s.email, s.status").
		Where("s.business_id = ? AND s.branch_id = ? AND s.status = ? AND s.deleted_at IS NULL", businessID, branchID, "active")
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(s.supplier_name) LIKE ? OR LOWER(s.supplier_code) LIKE ? OR LOWER(s.phone) LIKE ? OR LOWER(s.email) LIKE ?", like, like, like, like)
	}
	var suppliers []SupplierLookupItem
	err := db.Order("s.supplier_name ASC").Limit(query.Limit).Scan(&suppliers).Error
	return suppliers, err
}

func (r *Repository) NextSupplierCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+branchID+":suppliers").Error; err != nil {
		return "", err
	}
	return utils.NextSequentialNumber(tx.Table("suppliers").Where("business_id = ? AND branch_id = ?", businessID, branchID), "supplier_code", "SUP-", 6)
}

func (r *Repository) SupplierCodeExists(tx *gorm.DB, businessID, branchID, value string) (bool, error) {
	var count int64
	err := tx.Model(&Supplier{}).Where("business_id = ? AND branch_id = ? AND LOWER(supplier_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value).Count(&count).Error
	return count > 0, err
}

func (r *Repository) LoadSupplierResponse(businessID string, supplier Supplier) (SupplierResponse, error) {
	var primaryContact *SupplierContactResponse
	contacts, err := r.ListContacts(businessID, supplier.BranchID, supplier.ID)
	if err == nil {
		for _, contact := range contacts {
			if contact.IsPrimary {
				primaryContact = &contact
				break
			}
		}
	}
	return SupplierResponse{
		ID: supplier.ID, BusinessID: supplier.BusinessID, BranchID: supplier.BranchID, SupplierCode: supplier.SupplierCode, SupplierName: supplier.SupplierName,
		Phone: supplier.Phone, Email: supplier.Email, Website: supplier.Website,
		AddressLine1: supplier.AddressLine1, AddressLine2: supplier.AddressLine2, City: supplier.City, State: supplier.State, Country: supplier.Country,
		PostalCode: supplier.PostalCode, TaxNumber: supplier.TaxNumber, Notes: supplier.Notes, Status: supplier.Status, PrimaryContact: primaryContact,
		CreatedAt: supplier.CreatedAt, UpdatedAt: supplier.UpdatedAt,
	}, nil
}

func (r *Repository) LoadSupplierResponses(businessID string, suppliers []Supplier) ([]SupplierResponse, error) {
	responses := make([]SupplierResponse, 0, len(suppliers))
	for _, supplier := range suppliers {
		response, err := r.LoadSupplierResponse(businessID, supplier)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) CreateContact(tx *gorm.DB, contact *SupplierContact) error {
	return tx.Create(contact).Error
}

func (r *Repository) FindContact(contactID, supplierID, businessID, branchID string) (*SupplierContact, error) {
	var contact SupplierContact
	err := r.db.Where("id = ? AND supplier_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", contactID, supplierID, businessID, branchID).First(&contact).Error
	return &contact, err
}

func (r *Repository) ListContacts(businessID, branchID, supplierID string) ([]SupplierContactResponse, error) {
	var contacts []SupplierContactResponse
	err := r.db.Table("supplier_contacts").
		Select("id, supplier_id, contact_name, contact_role, phone, email, is_primary, notes, created_at, updated_at").
		Where("business_id = ? AND branch_id = ? AND supplier_id = ? AND deleted_at IS NULL", businessID, branchID, supplierID).
		Order("is_primary DESC, contact_name ASC").
		Scan(&contacts).Error
	return contacts, err
}

func (r *Repository) ClearPrimaryContact(tx *gorm.DB, businessID, branchID, supplierID string) error {
	return tx.Model(&SupplierContact{}).Where("business_id = ? AND branch_id = ? AND supplier_id = ? AND deleted_at IS NULL", businessID, branchID, supplierID).Update("is_primary", false).Error
}

func (r *Repository) UpdateContact(tx *gorm.DB, contactID, supplierID, businessID, branchID string, updates map[string]interface{}) error {
	result := tx.Model(&SupplierContact{}).Where("id = ? AND supplier_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", contactID, supplierID, businessID, branchID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CreateNote(tx *gorm.DB, note *SupplierNote) error {
	return tx.Create(note).Error
}

func (r *Repository) ListNotes(businessID, branchID, supplierID string) ([]SupplierNoteResponse, error) {
	var notes []SupplierNoteResponse
	err := r.db.Table("supplier_notes sn").
		Select("sn.id, sn.supplier_id, sn.note, sn.created_by_user_id, u.full_name AS created_by_name, sn.created_at, sn.updated_at").
		Joins("LEFT JOIN users u ON u.id = sn.created_by_user_id").
		Where("sn.business_id = ? AND sn.branch_id = ? AND sn.supplier_id = ? AND sn.deleted_at IS NULL", businessID, branchID, supplierID).
		Order("sn.created_at DESC").
		Scan(&notes).Error
	return notes, err
}

func (r *Repository) DeleteNote(tx *gorm.DB, businessID, branchID, supplierID, noteID string) error {
	result := tx.Model(&SupplierNote{}).Where("id = ? AND supplier_id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", noteID, supplierID, businessID, branchID).
		Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) Stats(businessID, branchID, supplierID string) (*SupplierStatsResponse, error) {
	var row supplierStatsRow
	err := r.db.Raw(supplierStatsSQL(), supplierStatsArgs(businessID, branchID, supplierID)...).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	return supplierStatsResponse(row), nil
}

func supplierStatsSQL() string {
	return `
		SELECT
			? AS supplier_id,
			(
				SELECT COUNT(*)
				FROM purchase_orders po
				WHERE po.business_id = ? AND po.branch_id = ? AND po.supplier_id = ?
					AND po.status <> 'cancelled' AND po.deleted_at IS NULL
			) AS total_purchase_orders,
			(
				SELECT COUNT(*)
				FROM purchase_invoices pi
				WHERE pi.business_id = ? AND pi.branch_id = ? AND pi.supplier_id = ?
					AND pi.status = 'posted' AND pi.deleted_at IS NULL
			) AS total_bills,
			(
				SELECT COALESCE(SUM(pi.total_amount), 0)
				FROM purchase_invoices pi
				WHERE pi.business_id = ? AND pi.branch_id = ? AND pi.supplier_id = ?
					AND pi.status = 'posted' AND pi.deleted_at IS NULL
			) AS total_purchase_amount,
			(
				SELECT COALESCE(SUM(sp.amount), 0)
				FROM supplier_payments sp
				WHERE sp.business_id = ? AND sp.branch_id = ? AND sp.supplier_id = ?
					AND sp.status = 'completed' AND sp.deleted_at IS NULL
			) AS supplier_payments_paid,
			(
				SELECT COALESCE(SUM(pip.amount), 0)
				FROM purchase_invoice_payments pip
				WHERE pip.business_id = ? AND pip.branch_id = ? AND pip.supplier_id = ?
					AND pip.payment_status = 'completed' AND pip.supplier_payment_id IS NULL
					AND pip.deleted_at IS NULL
			) AS invoice_payments_paid,
			(
				SELECT COALESCE(SUM(pr.return_total), 0)
				FROM purchase_returns pr
				WHERE pr.business_id = ? AND pr.branch_id = ? AND pr.supplier_id = ?
					AND pr.status = 'posted' AND pr.deleted_at IS NULL
			) AS vendor_credits,
			GREATEST(
				(
					SELECT MAX(po.order_date)
					FROM purchase_orders po
					WHERE po.business_id = ? AND po.branch_id = ? AND po.supplier_id = ?
						AND po.status <> 'cancelled' AND po.deleted_at IS NULL
				),
				(
					SELECT MAX(pi.invoice_date)
					FROM purchase_invoices pi
					WHERE pi.business_id = ? AND pi.branch_id = ? AND pi.supplier_id = ?
						AND pi.status = 'posted' AND pi.deleted_at IS NULL
				),
				(
					SELECT MAX(pr.received_date)
					FROM purchase_receipts pr
					WHERE pr.business_id = ? AND pr.branch_id = ? AND pr.supplier_id = ?
						AND pr.status = 'posted' AND pr.deleted_at IS NULL
				)
			) AS last_purchase_date
	`
}

func supplierStatsArgs(businessID, branchID, supplierID string) []interface{} {
	args := []interface{}{supplierID}
	for i := 0; i < 9; i++ {
		args = append(args, businessID, branchID, supplierID)
	}
	return args
}

func supplierStatsResponse(row supplierStatsRow) *SupplierStatsResponse {
	totalPaid := roundSupplierMoney(row.SupplierPaymentsPaid + row.InvoicePaymentsPaid)
	outstanding := roundSupplierMoney(row.TotalPurchaseAmount - totalPaid - row.VendorCredits)
	var lastPurchaseDate *string
	if row.LastPurchaseDate != nil {
		formatted := row.LastPurchaseDate.Format("2006-01-02")
		lastPurchaseDate = &formatted
	}
	return &SupplierStatsResponse{
		SupplierID:          row.SupplierID,
		TotalPurchaseOrders: row.TotalPurchaseOrders,
		TotalBills:          row.TotalBills,
		TotalPurchaseAmount: roundSupplierMoney(row.TotalPurchaseAmount),
		TotalPaidAmount:     totalPaid,
		LastPurchaseDate:    lastPurchaseDate,
		OutstandingBalance:  outstanding,
		OutstandingPayables: outstanding,
	}
}

func (r *Repository) StatementRows(businessID, branchID, supplierID string) ([]supplierStatementRow, error) {
	var rows []supplierStatementRow
	err := r.db.Raw(`
		SELECT *
		FROM (
			SELECT
				pi.id AS id,
				pi.id AS document_id,
				pi.invoice_number AS document_number,
				'bill' AS transaction_type,
				pi.invoice_date AS transaction_date,
				pi.branch_id AS branch_id,
				b.branch_name AS branch_name,
				pi.total_amount AS debit_amount,
				0::numeric AS credit_amount,
				pi.status AS status,
				pi.payment_status AS payment_status,
				'' AS reference_number,
				pi.notes AS notes,
				pi.purchase_order_id AS purchase_order_id,
				pi.id AS purchase_invoice_id,
				NULL::uuid AS purchase_receipt_id,
				NULL::uuid AS purchase_return_id,
				NULL::uuid AS payment_id,
				pi.created_at AS created_at
			FROM purchase_invoices pi
			JOIN branches b ON b.id = pi.branch_id AND b.business_id = pi.business_id
			WHERE pi.business_id = ? AND pi.branch_id = ? AND pi.supplier_id = ?
				AND pi.status = 'posted' AND pi.deleted_at IS NULL

			UNION ALL

			SELECT
				sp.id AS id,
				sp.id AS document_id,
				COALESCE(NULLIF(sp.reference_number, ''), sp.id::text) AS document_number,
				'payment_made' AS transaction_type,
				sp.payment_date::date AS transaction_date,
				sp.branch_id AS branch_id,
				b.branch_name AS branch_name,
				0::numeric AS debit_amount,
				sp.amount AS credit_amount,
				sp.status AS status,
				sp.status AS payment_status,
				sp.reference_number AS reference_number,
				sp.notes AS notes,
				NULL::uuid AS purchase_order_id,
				NULL::uuid AS purchase_invoice_id,
				NULL::uuid AS purchase_receipt_id,
				NULL::uuid AS purchase_return_id,
				sp.id AS payment_id,
				sp.created_at AS created_at
			FROM supplier_payments sp
			JOIN branches b ON b.id = sp.branch_id AND b.business_id = sp.business_id
			WHERE sp.business_id = ? AND sp.branch_id = ? AND sp.supplier_id = ?
				AND sp.status = 'completed' AND sp.deleted_at IS NULL

			UNION ALL

			SELECT
				pip.id AS id,
				pip.id AS document_id,
				COALESCE(NULLIF(pip.reference_number, ''), pip.id::text) AS document_number,
				'payment_made' AS transaction_type,
				pip.paid_at::date AS transaction_date,
				pip.branch_id AS branch_id,
				b.branch_name AS branch_name,
				0::numeric AS debit_amount,
				pip.amount AS credit_amount,
				pip.payment_status AS status,
				pip.payment_status AS payment_status,
				pip.reference_number AS reference_number,
				pip.notes AS notes,
				pi.purchase_order_id AS purchase_order_id,
				pip.purchase_invoice_id AS purchase_invoice_id,
				NULL::uuid AS purchase_receipt_id,
				NULL::uuid AS purchase_return_id,
				pip.id AS payment_id,
				pip.created_at AS created_at
			FROM purchase_invoice_payments pip
			JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id AND pi.business_id = pip.business_id
			JOIN branches b ON b.id = pip.branch_id AND b.business_id = pip.business_id
			WHERE pip.business_id = ? AND pip.branch_id = ? AND pip.supplier_id = ?
				AND pip.payment_status = 'completed' AND pip.deleted_at IS NULL
				AND pip.supplier_payment_id IS NULL AND pi.deleted_at IS NULL

			UNION ALL

			SELECT
				pr.id AS id,
				pr.id AS document_id,
				pr.return_number AS document_number,
				'vendor_credit' AS transaction_type,
				pr.return_date AS transaction_date,
				pr.branch_id AS branch_id,
				b.branch_name AS branch_name,
				0::numeric AS debit_amount,
				pr.return_total AS credit_amount,
				pr.status AS status,
				'' AS payment_status,
				pr.supplier_reference_number AS reference_number,
				pr.reason AS notes,
				pr.purchase_order_id AS purchase_order_id,
				pr.purchase_invoice_id AS purchase_invoice_id,
				pr.purchase_receipt_id AS purchase_receipt_id,
				pr.id AS purchase_return_id,
				NULL::uuid AS payment_id,
				pr.created_at AS created_at
			FROM purchase_returns pr
			JOIN branches b ON b.id = pr.branch_id AND b.business_id = pr.business_id
			WHERE pr.business_id = ? AND pr.branch_id = ? AND pr.supplier_id = ?
				AND pr.status = 'posted' AND pr.deleted_at IS NULL
		) statement
		ORDER BY transaction_date ASC, created_at ASC, document_number ASC
	`, businessID, branchID, supplierID, businessID, branchID, supplierID, businessID, branchID, supplierID, businessID, branchID, supplierID).Scan(&rows).Error
	return rows, err
}

func applySupplierFilters(db *gorm.DB, query SupplierListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(suppliers.supplier_name) LIKE ? OR LOWER(suppliers.supplier_code) LIKE ? OR LOWER(suppliers.phone) LIKE ? OR LOWER(suppliers.email) LIKE ?", like, like, like, like)
	}
	if query.Status != "" {
		db = db.Where("suppliers.status = ?", query.Status)
	}
	if query.City != "" {
		db = db.Where("LOWER(suppliers.city) = LOWER(?)", query.City)
	}
	if query.Country != "" {
		db = db.Where("LOWER(suppliers.country) = LOWER(?)", query.Country)
	}
	if query.DateFrom != "" {
		db = db.Where("suppliers.created_at >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("suppliers.created_at <= ?", query.DateTo)
	}
	return db
}

func safeSupplierSortBy(value string) string {
	switch value {
	case "supplier_name", "supplier_code", "status", "updated_at":
		return value
	default:
		return "created_at"
	}
}

func supplierTotalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

func newUUID() string {
	return utils.NewUUID()
}
