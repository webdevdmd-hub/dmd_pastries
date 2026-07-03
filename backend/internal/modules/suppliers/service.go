package suppliers

import (
	"math"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db        *gorm.DB
	repo      *Repository
	auditRepo *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo}
}

func (s *Service) ListSuppliers(currentUser *utils.AuthContext, query SupplierListQuery) (*SupplierListResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	normalizeSupplierListQuery(&query)
	if query.Status != "" && !validSupplierStatus(query.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	suppliers, total, err := s.repo.List(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list suppliers")
	}
	items, err := s.repo.LoadSupplierResponses(currentUser.BusinessID, suppliers)
	if err != nil {
		return nil, apperrors.Internal("failed to load supplier details")
	}
	return &SupplierListResponse{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: supplierTotalPages(total, query.Limit)}}, nil
}

func (s *Service) LookupSuppliers(currentUser *utils.AuthContext, query SupplierLookupQuery) (*SupplierLookupResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	query.Search = strings.TrimSpace(query.Search)
	if query.Limit <= 0 {
		query.Limit = 10
	}
	if query.Limit > 20 {
		query.Limit = 20
	}
	items, err := s.repo.Lookup(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to lookup suppliers")
	}
	return &SupplierLookupResponse{Items: items}, nil
}

func (s *Service) CreateSupplier(currentUser *utils.AuthContext, req CreateSupplierRequest, ipAddress, userAgent string) (*SupplierResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.validateSupplierPayload(req.SupplierName, req.Phone, req.Email, req.Website); err != nil {
		return nil, err
	}
	var id string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		code, err := s.generateSupplierCode(tx, currentUser.BusinessID, branchID)
		if err != nil {
			return apperrors.Internal("failed to generate supplier code")
		}
		supplier := &Supplier{
			ID:              newUUID(),
			BusinessID:      currentUser.BusinessID,
			BranchID:        branchID,
			SupplierCode:    code,
			SupplierName:    strings.TrimSpace(req.SupplierName),
			Phone:           strings.TrimSpace(req.Phone),
			Email:           strings.ToLower(strings.TrimSpace(req.Email)),
			Website:         strings.TrimSpace(req.Website),
			AddressLine1:    strings.TrimSpace(req.AddressLine1),
			AddressLine2:    strings.TrimSpace(req.AddressLine2),
			City:            strings.TrimSpace(req.City),
			State:           strings.TrimSpace(req.State),
			Country:         strings.TrimSpace(req.Country),
			PostalCode:      strings.TrimSpace(req.PostalCode),
			TaxNumber:       strings.TrimSpace(req.TaxNumber),
			Notes:           strings.TrimSpace(req.Notes),
			Status:          "active",
			CreatedByUserID: currentUser.UserID,
			UpdatedByUserID: currentUser.UserID,
		}
		if err := s.repo.Create(tx, supplier); err != nil {
			return apperrors.Internal("failed to create supplier")
		}
		id = supplier.ID
		return s.writeAudit(tx, currentUser, "supplier.created", supplier.ID, "Supplier created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetSupplier(currentUser, id)
}

func (s *Service) GetSupplier(currentUser *utils.AuthContext, id string) (*SupplierResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	supplier, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		return nil, mapSupplierNotFound(err, "supplier not found")
	}
	response, err := s.repo.LoadSupplierResponse(currentUser.BusinessID, *supplier)
	if err != nil {
		return nil, apperrors.Internal("failed to load supplier details")
	}
	return &response, nil
}

func (s *Service) UpdateSupplier(currentUser *utils.AuthContext, id string, req UpdateSupplierRequest, ipAddress, userAgent string) (*SupplierResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(id, currentUser.BusinessID, branchID); err != nil {
		return nil, mapSupplierNotFound(err, "supplier not found")
	}
	if err := s.validateSupplierPayload(firstNonEmpty(req.SupplierName, "valid"), req.Phone, req.Email, req.Website); err != nil {
		return nil, err
	}
	updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
	setString(updates, "supplier_name", req.SupplierName)
	setString(updates, "phone", req.Phone)
	setStringLower(updates, "email", req.Email)
	setString(updates, "website", req.Website)
	setString(updates, "address_line_1", req.AddressLine1)
	setString(updates, "address_line_2", req.AddressLine2)
	setString(updates, "city", req.City)
	setString(updates, "state", req.State)
	setString(updates, "country", req.Country)
	setString(updates, "postal_code", req.PostalCode)
	setString(updates, "tax_number", req.TaxNumber)
	setString(updates, "notes", req.Notes)
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, updates); err != nil {
			return mapSupplierNotFound(err, "supplier not found")
		}
		return s.writeAudit(tx, currentUser, "supplier.updated", id, "Supplier updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetSupplier(currentUser, id)
}

func (s *Service) UpdateSupplierStatus(currentUser *utils.AuthContext, id string, req UpdateSupplierStatusRequest, ipAddress, userAgent string) (*SupplierResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if !validSupplierStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": req.Status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return mapSupplierNotFound(err, "supplier not found")
		}
		return s.writeAudit(tx, currentUser, "supplier.status_updated", id, "Supplier status updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetSupplier(currentUser, id)
}

func (s *Service) DeleteSupplier(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": "inactive", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC(), "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}}); err != nil {
			return mapSupplierNotFound(err, "supplier not found")
		}
		return s.writeAudit(tx, currentUser, "supplier.deleted", id, "Supplier deleted.", ipAddress, userAgent)
	})
}

func (s *Service) ListContacts(currentUser *utils.AuthContext, supplierID string) ([]SupplierContactResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(supplierID, currentUser.BusinessID, branchID); err != nil {
		return nil, mapSupplierNotFound(err, "supplier not found")
	}
	return s.repo.ListContacts(currentUser.BusinessID, branchID, supplierID)
}

func (s *Service) CreateContact(currentUser *utils.AuthContext, supplierID string, req CreateSupplierContactRequest, ipAddress, userAgent string) (*SupplierContactResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := validateContact(req.ContactName, req.Phone, req.Email); err != nil {
		return nil, err
	}
	contact := &SupplierContact{ID: newUUID(), BusinessID: currentUser.BusinessID, BranchID: branchID, SupplierID: supplierID, ContactName: strings.TrimSpace(req.ContactName), ContactRole: strings.TrimSpace(req.ContactRole), Phone: strings.TrimSpace(req.Phone), Email: strings.ToLower(strings.TrimSpace(req.Email)), IsPrimary: req.IsPrimary, Notes: strings.TrimSpace(req.Notes)}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindByID(supplierID, currentUser.BusinessID, branchID); err != nil {
			return mapSupplierNotFound(err, "supplier not found")
		}
		if req.IsPrimary {
			if err := s.repo.ClearPrimaryContact(tx, currentUser.BusinessID, branchID, supplierID); err != nil {
				return apperrors.Internal("failed to update primary contact")
			}
		}
		if err := s.repo.CreateContact(tx, contact); err != nil {
			return apperrors.Internal("failed to create supplier contact")
		}
		return s.writeAudit(tx, currentUser, "supplier.contact_created", supplierID, "Supplier contact created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	contacts, _ := s.repo.ListContacts(currentUser.BusinessID, branchID, supplierID)
	for _, item := range contacts {
		if item.ID == contact.ID {
			return &item, nil
		}
	}
	return nil, apperrors.Internal("failed to load supplier contact")
}

func (s *Service) UpdateContact(currentUser *utils.AuthContext, supplierID, contactID string, req UpdateSupplierContactRequest, ipAddress, userAgent string) (*SupplierContactResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if req.ContactName != "" || req.Phone != "" || req.Email != "" {
		if err := validateContact(firstNonEmpty(req.ContactName, "valid"), req.Phone, req.Email); err != nil {
			return nil, err
		}
	}
	updates := map[string]interface{}{"updated_at": time.Now().UTC()}
	setString(updates, "contact_name", req.ContactName)
	setString(updates, "contact_role", req.ContactRole)
	setString(updates, "phone", req.Phone)
	setStringLower(updates, "email", req.Email)
	setString(updates, "notes", req.Notes)
	if req.IsPrimary != nil {
		updates["is_primary"] = *req.IsPrimary
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindContact(contactID, supplierID, currentUser.BusinessID, branchID); err != nil {
			return mapSupplierNotFound(err, "supplier contact not found")
		}
		if req.IsPrimary != nil && *req.IsPrimary {
			if err := s.repo.ClearPrimaryContact(tx, currentUser.BusinessID, branchID, supplierID); err != nil {
				return apperrors.Internal("failed to update primary contact")
			}
		}
		if err := s.repo.UpdateContact(tx, contactID, supplierID, currentUser.BusinessID, branchID, updates); err != nil {
			return mapSupplierNotFound(err, "supplier contact not found")
		}
		return s.writeAudit(tx, currentUser, "supplier.contact_updated", supplierID, "Supplier contact updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	contacts, _ := s.repo.ListContacts(currentUser.BusinessID, branchID, supplierID)
	for _, item := range contacts {
		if item.ID == contactID {
			return &item, nil
		}
	}
	return nil, apperrors.NotFound("supplier contact not found")
}

func (s *Service) DeleteContact(currentUser *utils.AuthContext, supplierID, contactID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateContact(tx, contactID, supplierID, currentUser.BusinessID, branchID, map[string]interface{}{"updated_at": time.Now().UTC(), "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}}); err != nil {
			return mapSupplierNotFound(err, "supplier contact not found")
		}
		return s.writeAudit(tx, currentUser, "supplier.contact_deleted", supplierID, "Supplier contact deleted.", ipAddress, userAgent)
	})
}

func (s *Service) ListNotes(currentUser *utils.AuthContext, supplierID string) ([]SupplierNoteResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(supplierID, currentUser.BusinessID, branchID); err != nil {
		return nil, mapSupplierNotFound(err, "supplier not found")
	}
	return s.repo.ListNotes(currentUser.BusinessID, branchID, supplierID)
}

func (s *Service) AddNote(currentUser *utils.AuthContext, supplierID string, req CreateSupplierNoteRequest, ipAddress, userAgent string) (*SupplierNoteResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Note) == "" {
		return nil, apperrors.BadRequest("note is required", nil)
	}
	note := &SupplierNote{ID: newUUID(), BusinessID: currentUser.BusinessID, BranchID: branchID, SupplierID: supplierID, Note: strings.TrimSpace(req.Note), CreatedByUserID: currentUser.UserID}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindByID(supplierID, currentUser.BusinessID, branchID); err != nil {
			return mapSupplierNotFound(err, "supplier not found")
		}
		if err := s.repo.CreateNote(tx, note); err != nil {
			return apperrors.Internal("failed to add supplier note")
		}
		return s.writeAudit(tx, currentUser, "supplier.note_added", supplierID, "Supplier note added.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	notes, _ := s.repo.ListNotes(currentUser.BusinessID, branchID, supplierID)
	for _, item := range notes {
		if item.ID == note.ID {
			return &item, nil
		}
	}
	return nil, apperrors.Internal("failed to load supplier note")
}

func (s *Service) DeleteNote(currentUser *utils.AuthContext, supplierID, noteID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.DeleteNote(tx, currentUser.BusinessID, branchID, supplierID, noteID); err != nil {
			return mapSupplierNotFound(err, "supplier note not found")
		}
		return s.writeAudit(tx, currentUser, "supplier.note_deleted", supplierID, "Supplier note deleted.", ipAddress, userAgent)
	})
}

func (s *Service) Stats(currentUser *utils.AuthContext, supplierID string) (*SupplierStatsResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(supplierID, currentUser.BusinessID, branchID); err != nil {
		return nil, mapSupplierNotFound(err, "supplier not found")
	}
	return s.repo.Stats(currentUser.BusinessID, supplierID)
}

func (s *Service) Statement(currentUser *utils.AuthContext, supplierID string, query SupplierStatementQuery) (*SupplierStatementResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	supplier, err := s.repo.FindByID(supplierID, currentUser.BusinessID, branchID)
	if err != nil {
		return nil, mapSupplierNotFound(err, "supplier not found")
	}
	dateFrom, err := parseSupplierStatementDate(query.DateFrom, "date_from")
	if err != nil {
		return nil, err
	}
	dateTo, err := parseSupplierStatementDate(query.DateTo, "date_to")
	if err != nil {
		return nil, err
	}
	if dateFrom != nil && dateTo != nil && dateFrom.After(*dateTo) {
		return nil, apperrors.BadRequest("date_from must be before or equal to date_to", nil)
	}
	transactionType := strings.TrimSpace(query.TransactionType)
	if transactionType != "" && transactionType != "all" && !validSupplierStatementTransactionType(transactionType) {
		return nil, apperrors.BadRequest("invalid transaction_type", nil)
	}
	rows, err := s.repo.StatementRows(currentUser.BusinessID, supplier.BranchID, supplier.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load supplier statement")
	}
	response := &SupplierStatementResponse{
		SupplierID:   supplier.ID,
		SupplierCode: supplier.SupplierCode,
		SupplierName: supplier.SupplierName,
		DateFrom:     strings.TrimSpace(query.DateFrom),
		DateTo:       strings.TrimSpace(query.DateTo),
		Items:        make([]SupplierStatementItemResponse, 0, len(rows)),
	}
	balance := 0.0
	for _, row := range rows {
		rowDate := dateOnly(row.TransactionDate)
		if dateFrom != nil && rowDate.Before(*dateFrom) {
			balance = roundSupplierMoney(balance + row.DebitAmount - row.CreditAmount)
			response.OpeningBalance = balance
			continue
		}
		if dateTo != nil && rowDate.After(*dateTo) {
			continue
		}
		if transactionType != "" && transactionType != "all" && row.TransactionType != transactionType {
			balance = roundSupplierMoney(balance + row.DebitAmount - row.CreditAmount)
			continue
		}
		balance = roundSupplierMoney(balance + row.DebitAmount - row.CreditAmount)
		response.TotalDebit = roundSupplierMoney(response.TotalDebit + row.DebitAmount)
		response.TotalCredit = roundSupplierMoney(response.TotalCredit + row.CreditAmount)
		response.Items = append(response.Items, SupplierStatementItemResponse{
			ID:                row.ID,
			DocumentID:        row.DocumentID,
			DocumentNumber:    row.DocumentNumber,
			TransactionType:   row.TransactionType,
			TransactionDate:   row.TransactionDate,
			BranchID:          row.BranchID,
			BranchName:        row.BranchName,
			DebitAmount:       roundSupplierMoney(row.DebitAmount),
			CreditAmount:      roundSupplierMoney(row.CreditAmount),
			RunningBalance:    balance,
			Status:            row.Status,
			PaymentStatus:     row.PaymentStatus,
			ReferenceNumber:   row.ReferenceNumber,
			Notes:             row.Notes,
			PurchaseOrderID:   row.PurchaseOrderID,
			PurchaseInvoiceID: row.PurchaseInvoiceID,
			PurchaseReceiptID: row.PurchaseReceiptID,
			PurchaseReturnID:  row.PurchaseReturnID,
			PaymentID:         row.PaymentID,
		})
	}
	response.ClosingBalance = balance
	response.OpeningBalance = roundSupplierMoney(response.OpeningBalance)
	response.TotalDebit = roundSupplierMoney(response.TotalDebit)
	response.TotalCredit = roundSupplierMoney(response.TotalCredit)
	response.ClosingBalance = roundSupplierMoney(response.ClosingBalance)
	return response, nil
}

func (s *Service) validateSupplierPayload(name, phone, email, website string) error {
	if strings.TrimSpace(name) == "" {
		return apperrors.BadRequest("supplier_name is required", nil)
	}
	if err := validateSupplierContact(phone, email, website); err != nil {
		return err
	}
	return nil
}

func (s *Service) generateSupplierCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	for i := 0; i < 10; i++ {
		code, err := s.repo.NextSupplierCode(tx, businessID, branchID)
		if err != nil {
			return "", err
		}
		exists, err := s.repo.SupplierCodeExists(tx, businessID, branchID, code)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "SUP-" + time.Now().UTC().Format("20060102150405"), nil
}

func (s *Service) withTransaction(fn func(tx *gorm.DB) error) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit supplier change")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "suppliers", EntityID: entityID, Summary: summary, Metadata: audit.Metadata(map[string]interface{}{"source_module": "suppliers"}, nil), IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func normalizeSupplierListQuery(query *SupplierListQuery) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	if query.SortBy == "" {
		query.SortBy = "created_at"
	}
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}
}

func validSupplierStatus(value string) bool {
	return value == "active" || value == "inactive" || value == "blocked"
}

func validateSupplierContact(phone, email, website string) error {
	if strings.TrimSpace(phone) != "" {
		ok, _ := regexp.MatchString(`^[0-9+()\-\s]{6,30}$`, strings.TrimSpace(phone))
		if !ok {
			return apperrors.BadRequest("phone format is invalid", nil)
		}
	}
	if strings.TrimSpace(email) != "" {
		ok, _ := regexp.MatchString(`^[^@\s]+@[^@\s]+\.[^@\s]+$`, strings.TrimSpace(email))
		if !ok {
			return apperrors.BadRequest("email format is invalid", nil)
		}
	}
	if strings.TrimSpace(website) != "" {
		ok, _ := regexp.MatchString(`^https?://.+`, strings.TrimSpace(website))
		if !ok {
			return apperrors.BadRequest("website must start with http:// or https://", nil)
		}
	}
	return nil
}

func validateContact(name, phone, email string) error {
	if strings.TrimSpace(name) == "" {
		return apperrors.BadRequest("contact_name is required", nil)
	}
	return validateSupplierContact(phone, email, "")
}

func parseSupplierStatementDate(value, field string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, apperrors.BadRequest(field+" must use YYYY-MM-DD format", nil)
	}
	parsed = dateOnly(parsed)
	return &parsed, nil
}

func dateOnly(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func validSupplierStatementTransactionType(value string) bool {
	return value == "bill" || value == "payment_made" || value == "vendor_credit"
}

func roundSupplierMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func setString(updates map[string]interface{}, key, value string) {
	if strings.TrimSpace(value) != "" {
		updates[key] = strings.TrimSpace(value)
	}
}

func setStringLower(updates map[string]interface{}, key, value string) {
	if strings.TrimSpace(value) != "" {
		updates[key] = strings.ToLower(strings.TrimSpace(value))
	}
}

func firstNonEmpty(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func mapSupplierNotFound(err error, message string) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound(message)
	}
	return apperrors.Internal("supplier operation failed")
}
