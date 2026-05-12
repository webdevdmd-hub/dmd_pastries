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
		Select("s.id, s.supplier_code, s.supplier_name, s.supplier_category_id, sc.category_name, s.phone, s.email, s.status").
		Joins("LEFT JOIN supplier_categories sc ON sc.id = s.supplier_category_id AND sc.business_id = s.business_id AND sc.branch_id = s.branch_id").
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
	var count int64
	if err := tx.Model(&Supplier{}).Where("business_id = ? AND branch_id = ?", businessID, branchID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("SUP-%06d", count+1), nil
}

func (r *Repository) SupplierCodeExists(tx *gorm.DB, businessID, branchID, value string) (bool, error) {
	var count int64
	err := tx.Model(&Supplier{}).Where("business_id = ? AND branch_id = ? AND LOWER(supplier_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, value).Count(&count).Error
	return count > 0, err
}

func (r *Repository) ValidateCategory(businessID, branchID, categoryID string) error {
	if strings.TrimSpace(categoryID) == "" {
		return nil
	}
	var count int64
	err := r.db.Table("supplier_categories").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", categoryID, businessID, branchID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) LoadSupplierResponse(businessID string, supplier Supplier) (SupplierResponse, error) {
	categoryName := ""
	if supplier.SupplierCategoryID != nil {
		_ = r.db.Table("supplier_categories").Select("category_name").Where("id = ? AND business_id = ? AND branch_id = ?", *supplier.SupplierCategoryID, businessID, supplier.BranchID).Scan(&categoryName).Error
	}
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
		SupplierCategoryID: supplier.SupplierCategoryID, CategoryName: categoryName, Phone: supplier.Phone, Email: supplier.Email, Website: supplier.Website,
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

func (r *Repository) Stats(businessID, supplierID string) (*SupplierStatsResponse, error) {
	return &SupplierStatsResponse{SupplierID: supplierID, TotalPurchaseOrders: 0, TotalPurchaseAmount: 0, LastPurchaseDate: nil, OutstandingPayables: 0}, nil
}

func applySupplierFilters(db *gorm.DB, query SupplierListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(query.Search) + "%"
		db = db.Where("LOWER(suppliers.supplier_name) LIKE ? OR LOWER(suppliers.supplier_code) LIKE ? OR LOWER(suppliers.phone) LIKE ? OR LOWER(suppliers.email) LIKE ?", like, like, like, like)
	}
	if query.SupplierCategoryID != "" {
		db = db.Where("suppliers.supplier_category_id = ?", query.SupplierCategoryID)
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
