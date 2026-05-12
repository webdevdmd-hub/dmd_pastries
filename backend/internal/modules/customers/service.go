package customers

import (
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

func (s *Service) ListCustomers(currentUser *utils.AuthContext, query CustomerListQuery) (*CustomerListResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	normalizeCustomerListQuery(&query)
	if query.Status != "" && !validCustomerStatus(query.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	customers, total, err := s.repo.List(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list customers")
	}
	items, err := s.repo.LoadCustomerResponses(currentUser.BusinessID, customers)
	if err != nil {
		return nil, apperrors.Internal("failed to load customer details")
	}
	return &CustomerListResponse{
		Items: items,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: customerTotalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) LookupCustomers(currentUser *utils.AuthContext, query CustomerLookupQuery) (*CustomerLookupResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	normalizeLookupQuery(&query)
	if strings.TrimSpace(query.Phone) == "" && strings.TrimSpace(query.Email) == "" && strings.TrimSpace(query.Search) == "" {
		return nil, apperrors.BadRequest("phone, email, or search is required", nil)
	}
	customers, err := s.repo.Lookup(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to lookup customers")
	}
	return &CustomerLookupResponse{Items: customers}, nil
}

func (s *Service) CreateCustomer(currentUser *utils.AuthContext, req CreateCustomerRequest, ipAddress, userAgent string) (*CustomerResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.validateCreate(currentUser.BusinessID, branchID, req); err != nil {
		return nil, err
	}
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		customerCode, err := s.generateCustomerCode(tx, currentUser.BusinessID, branchID)
		if err != nil {
			return apperrors.Internal("failed to generate customer code")
		}
		customer := &Customer{
			ID:              utils.NewUUID(),
			BusinessID:      currentUser.BusinessID,
			BranchID:        branchID,
			CustomerCode:    customerCode,
			FullName:        strings.TrimSpace(req.FullName),
			Phone:           strings.TrimSpace(req.Phone),
			Email:           strings.ToLower(strings.TrimSpace(req.Email)),
			DateOfBirth:     parseDatePointer(req.DateOfBirth),
			Gender:          cleanCustomerStringPointer(req.Gender),
			AddressLine1:    strings.TrimSpace(req.AddressLine1),
			AddressLine2:    strings.TrimSpace(req.AddressLine2),
			City:            strings.TrimSpace(req.City),
			State:           strings.TrimSpace(req.State),
			Country:         strings.TrimSpace(req.Country),
			PostalCode:      strings.TrimSpace(req.PostalCode),
			Notes:           strings.TrimSpace(req.Notes),
			Status:          "active",
			CreatedByUserID: currentUser.UserID,
			UpdatedByUserID: currentUser.UserID,
		}
		if err := s.repo.Create(tx, customer); err != nil {
			return apperrors.Internal("failed to create customer")
		}
		if len(req.TagIDs) > 0 {
			if err := s.repo.ReplaceCustomerTags(tx, currentUser.BusinessID, branchID, customer.ID, uniqueStrings(req.TagIDs)); err != nil {
				return apperrors.Internal("failed to attach customer tags")
			}
		}
		createdID = customer.ID
		return s.writeAudit(tx, currentUser, "customer.created", customer.ID, "Customer created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetCustomer(currentUser, createdID)
}

func (s *Service) QuickCreateCustomer(currentUser *utils.AuthContext, req QuickCreateCustomerRequest, ipAddress, userAgent string) (*CustomerResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.validateQuickCreate(currentUser.BusinessID, req); err != nil {
		return nil, err
	}
	existing, err := s.repo.FindByContact(currentUser.BusinessID, branchID, strings.TrimSpace(req.Phone), strings.ToLower(strings.TrimSpace(req.Email)))
	if err == nil {
		switch existing.Status {
		case "active":
			response, err := s.repo.LoadCustomerResponse(currentUser.BusinessID, *existing)
			if err != nil {
				return nil, apperrors.Internal("failed to load existing customer")
			}
			return &response, nil
		case "blocked":
			return nil, apperrors.BadRequest("existing customer is blocked", nil)
		default:
			return nil, apperrors.Conflict("customer already exists but is not active", nil)
		}
	} else if err != gorm.ErrRecordNotFound {
		return nil, apperrors.Internal("failed to check existing customer")
	}
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		customerCode, err := s.generateCustomerCode(tx, currentUser.BusinessID, branchID)
		if err != nil {
			return apperrors.Internal("failed to generate customer code")
		}
		fullName := strings.TrimSpace(req.FullName)
		if fullName == "" {
			fullName = "Customer " + strings.TrimSpace(req.Phone)
		}
		customer := &Customer{
			ID:              utils.NewUUID(),
			BusinessID:      currentUser.BusinessID,
			BranchID:        branchID,
			CustomerCode:    customerCode,
			FullName:        fullName,
			Phone:           strings.TrimSpace(req.Phone),
			Email:           strings.ToLower(strings.TrimSpace(req.Email)),
			Status:          "active",
			CreatedByUserID: currentUser.UserID,
			UpdatedByUserID: currentUser.UserID,
		}
		if err := s.repo.Create(tx, customer); err != nil {
			return apperrors.Internal("failed to quick-create customer")
		}
		createdID = customer.ID
		return s.writeAudit(tx, currentUser, "customer.quick_created", customer.ID, "Customer quick-created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetCustomer(currentUser, createdID)
}

func (s *Service) GetCustomer(currentUser *utils.AuthContext, id string) (*CustomerResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	customer, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	response, err := s.repo.LoadCustomerResponse(currentUser.BusinessID, *customer)
	if err != nil {
		return nil, apperrors.Internal("failed to load customer details")
	}
	return &response, nil
}

func (s *Service) UpdateCustomer(currentUser *utils.AuthContext, id string, req UpdateCustomerRequest, ipAddress, userAgent string) (*CustomerResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	if err := s.validateUpdate(currentUser.BusinessID, branchID, id, req); err != nil {
		return nil, err
	}
	updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
	if strings.TrimSpace(req.FullName) != "" {
		updates["full_name"] = strings.TrimSpace(req.FullName)
	}
	if req.Phone != "" {
		updates["phone"] = strings.TrimSpace(req.Phone)
	}
	if req.Email != "" {
		updates["email"] = strings.ToLower(strings.TrimSpace(req.Email))
	}
	if req.DateOfBirth != "" {
		updates["date_of_birth"] = parseDatePointer(req.DateOfBirth)
	}
	if req.Gender != "" {
		updates["gender"] = strings.TrimSpace(req.Gender)
	}
	if req.AddressLine1 != "" {
		updates["address_line_1"] = strings.TrimSpace(req.AddressLine1)
	}
	if req.AddressLine2 != "" {
		updates["address_line_2"] = strings.TrimSpace(req.AddressLine2)
	}
	if req.City != "" {
		updates["city"] = strings.TrimSpace(req.City)
	}
	if req.State != "" {
		updates["state"] = strings.TrimSpace(req.State)
	}
	if req.Country != "" {
		updates["country"] = strings.TrimSpace(req.Country)
	}
	if req.PostalCode != "" {
		updates["postal_code"] = strings.TrimSpace(req.PostalCode)
	}
	if req.Notes != "" {
		updates["notes"] = strings.TrimSpace(req.Notes)
	}

	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, updates); err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.NotFound("customer not found")
			}
			return apperrors.Internal("failed to update customer")
		}
		if req.TagIDs != nil {
			if err := s.repo.ReplaceCustomerTags(tx, currentUser.BusinessID, branchID, id, uniqueStrings(req.TagIDs)); err != nil {
				return apperrors.Internal("failed to update customer tags")
			}
		}
		return s.writeAudit(tx, currentUser, "customer.updated", id, "Customer updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetCustomer(currentUser, id)
}

func (s *Service) UpdateCustomerStatus(currentUser *utils.AuthContext, id string, req UpdateCustomerStatusRequest, ipAddress, userAgent string) (*CustomerResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if !validCustomerStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	if _, err := s.repo.FindByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{
			"status":             req.Status,
			"updated_by_user_id": currentUser.UserID,
			"updated_at":         time.Now().UTC(),
		}); err != nil {
			return apperrors.Internal("failed to update customer status")
		}
		return s.writeAudit(tx, currentUser, "customer.status_updated", id, "Customer status updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetCustomer(currentUser, id)
}

func (s *Service) DeleteCustomer(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	if _, err := s.repo.FindByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("customer not found")
		}
		return apperrors.Internal("failed to load customer")
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{
			"status":             "inactive",
			"updated_by_user_id": currentUser.UserID,
			"updated_at":         time.Now().UTC(),
			"deleted_at":         gorm.DeletedAt{Time: time.Now().UTC(), Valid: true},
		}); err != nil {
			return apperrors.Internal("failed to delete customer")
		}
		return s.writeAudit(tx, currentUser, "customer.deleted", id, "Customer deleted.", ipAddress, userAgent)
	})
}

func (s *Service) ListTags(currentUser *utils.AuthContext) ([]CustomerTagResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	tags, err := s.repo.ListTags(currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list customer tags")
	}
	return tags, nil
}

func (s *Service) CreateTag(currentUser *utils.AuthContext, req CreateCustomerTagRequest, ipAddress, userAgent string) (*CustomerTagResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.TagName) == "" {
		return nil, apperrors.BadRequest("tag_name is required", nil)
	}
	if err := validateHexColor(req.Color); err != nil {
		return nil, err
	}
	if exists, err := s.repo.TagNameExists(currentUser.BusinessID, branchID, strings.TrimSpace(req.TagName), ""); err != nil {
		return nil, apperrors.Internal("failed to validate tag name")
	} else if exists {
		return nil, apperrors.Conflict("tag_name already exists", nil)
	}
	tag := &CustomerTag{
		ID:         utils.NewUUID(),
		BusinessID: currentUser.BusinessID,
		BranchID:   branchID,
		TagName:    strings.TrimSpace(req.TagName),
		Color:      strings.TrimSpace(req.Color),
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.CreateTag(tx, tag); err != nil {
			return apperrors.Internal("failed to create customer tag")
		}
		return s.writeAudit(tx, currentUser, "customer_tag.created", tag.ID, "Customer tag created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return &CustomerTagResponse{ID: tag.ID, TagName: tag.TagName, Color: tag.Color, CreatedAt: tag.CreatedAt, UpdatedAt: tag.UpdatedAt}, nil
}

func (s *Service) UpdateTag(currentUser *utils.AuthContext, id string, req UpdateCustomerTagRequest, ipAddress, userAgent string) (*CustomerTagResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindTagByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer tag not found")
		}
		return nil, apperrors.Internal("failed to load customer tag")
	}
	if strings.TrimSpace(req.TagName) != "" {
		if exists, err := s.repo.TagNameExists(currentUser.BusinessID, branchID, strings.TrimSpace(req.TagName), id); err != nil {
			return nil, apperrors.Internal("failed to validate tag name")
		} else if exists {
			return nil, apperrors.Conflict("tag_name already exists", nil)
		}
	}
	if err := validateHexColor(req.Color); err != nil {
		return nil, err
	}
	updates := map[string]interface{}{"updated_at": time.Now().UTC()}
	if strings.TrimSpace(req.TagName) != "" {
		updates["tag_name"] = strings.TrimSpace(req.TagName)
	}
	if req.Color != "" {
		updates["color"] = strings.TrimSpace(req.Color)
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateTag(tx, id, currentUser.BusinessID, branchID, updates); err != nil {
			return apperrors.Internal("failed to update customer tag")
		}
		return s.writeAudit(tx, currentUser, "customer_tag.updated", id, "Customer tag updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	tag, _ := s.repo.FindTagByID(id, currentUser.BusinessID, branchID)
	return &CustomerTagResponse{ID: tag.ID, TagName: tag.TagName, Color: tag.Color, CreatedAt: tag.CreatedAt, UpdatedAt: tag.UpdatedAt}, nil
}

func (s *Service) DeleteTag(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	if _, err := s.repo.FindTagByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("customer tag not found")
		}
		return apperrors.Internal("failed to load customer tag")
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateTag(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{
			"updated_at": time.Now().UTC(),
			"deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true},
		}); err != nil {
			return apperrors.Internal("failed to delete customer tag")
		}
		if err := tx.Where("business_id = ? AND branch_id = ? AND tag_id = ?", currentUser.BusinessID, branchID, id).Delete(&CustomerTagMapping{}).Error; err != nil {
			return apperrors.Internal("failed to remove customer tag mappings")
		}
		return s.writeAudit(tx, currentUser, "customer_tag.deleted", id, "Customer tag deleted.", ipAddress, userAgent)
	})
}

func (s *Service) ListCustomerTags(currentUser *utils.AuthContext, customerID string) ([]CustomerTagResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	tags, err := s.repo.ListCustomerTags(currentUser.BusinessID, branchID, customerID)
	if err != nil {
		return nil, apperrors.Internal("failed to list customer tags")
	}
	return tags, nil
}

func (s *Service) AttachTag(currentUser *utils.AuthContext, customerID string, req AssignCustomerTagRequest, ipAddress, userAgent string) ([]CustomerTagResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	if _, err := s.repo.FindTagByID(req.TagID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid tag_id", nil)
		}
		return nil, apperrors.Internal("failed to load customer tag")
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.AttachCustomerTag(tx, currentUser.BusinessID, branchID, customerID, req.TagID); err != nil {
			return apperrors.Internal("failed to attach customer tag")
		}
		return s.writeAudit(tx, currentUser, "customer.tag_attached", customerID, "Customer tag attached.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.ListCustomerTags(currentUser, customerID)
}

func (s *Service) RemoveTag(currentUser *utils.AuthContext, customerID, tagID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("customer not found")
		}
		return apperrors.Internal("failed to load customer")
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.RemoveCustomerTag(tx, currentUser.BusinessID, branchID, customerID, tagID); err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.NotFound("customer tag mapping not found")
			}
			return apperrors.Internal("failed to remove customer tag")
		}
		return s.writeAudit(tx, currentUser, "customer.tag_removed", customerID, "Customer tag removed.", ipAddress, userAgent)
	})
}

func (s *Service) ListNotes(currentUser *utils.AuthContext, customerID string) ([]CustomerNoteResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	notes, err := s.repo.ListNotes(currentUser.BusinessID, branchID, customerID)
	if err != nil {
		return nil, apperrors.Internal("failed to list customer notes")
	}
	return notes, nil
}

func (s *Service) AddNote(currentUser *utils.AuthContext, customerID string, req CreateCustomerNoteRequest, ipAddress, userAgent string) (*CustomerNoteResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Note) == "" {
		return nil, apperrors.BadRequest("note is required", nil)
	}
	if len(strings.TrimSpace(req.Note)) > 1000 {
		return nil, apperrors.BadRequest("note cannot exceed 1000 characters", nil)
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	note := &CustomerNote{
		ID:              utils.NewUUID(),
		BusinessID:      currentUser.BusinessID,
		BranchID:        branchID,
		CustomerID:      customerID,
		Note:            strings.TrimSpace(req.Note),
		CreatedByUserID: currentUser.UserID,
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.CreateNote(tx, note); err != nil {
			return apperrors.Internal("failed to add customer note")
		}
		return s.writeAudit(tx, currentUser, "customer.note_added", customerID, "Customer note added.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	notes, err := s.repo.ListNotes(currentUser.BusinessID, branchID, customerID)
	if err != nil {
		return nil, apperrors.Internal("failed to load customer note")
	}
	for _, item := range notes {
		if item.ID == note.ID {
			return &item, nil
		}
	}
	return &CustomerNoteResponse{ID: note.ID, CustomerID: customerID, Note: note.Note, CreatedByUserID: currentUser.UserID, CreatedAt: note.CreatedAt, UpdatedAt: note.UpdatedAt}, nil
}

func (s *Service) DeleteNote(currentUser *utils.AuthContext, customerID, noteID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("customer not found")
		}
		return apperrors.Internal("failed to load customer")
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.DeleteNote(tx, currentUser.BusinessID, branchID, customerID, noteID); err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.NotFound("customer note not found")
			}
			return apperrors.Internal("failed to delete customer note")
		}
		return s.writeAudit(tx, currentUser, "customer.note_deleted", customerID, "Customer note deleted.", ipAddress, userAgent)
	})
}

func (s *Service) Stats(currentUser *utils.AuthContext, customerID string) (*CustomerStatsResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(customerID, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("customer not found")
		}
		return nil, apperrors.Internal("failed to load customer")
	}
	stats, err := s.repo.Stats(currentUser.BusinessID, branchID, customerID)
	if err != nil {
		return nil, apperrors.Internal("failed to load customer stats")
	}
	return stats, nil
}

func (s *Service) validateCreate(businessID, branchID string, req CreateCustomerRequest) error {
	if strings.TrimSpace(req.FullName) == "" {
		return apperrors.BadRequest("full_name is required", nil)
	}
	if strings.TrimSpace(req.Phone) == "" && strings.TrimSpace(req.Email) == "" {
		return apperrors.BadRequest("phone or email is required", nil)
	}
	if err := validateCustomerContact(req.Phone, req.Email); err != nil {
		return err
	}
	if err := validateGender(req.Gender); err != nil {
		return err
	}
	if req.DateOfBirth != "" && parseDatePointer(req.DateOfBirth) == nil {
		return apperrors.BadRequest("date_of_birth must use YYYY-MM-DD", nil)
	}
	if err := s.validateUniqueContact(businessID, branchID, "", req.Phone, req.Email); err != nil {
		return err
	}
	if err := s.repo.ValidateTagIDs(businessID, branchID, uniqueStrings(req.TagIDs)); err != nil {
		return apperrors.BadRequest("invalid tag_ids", nil)
	}
	return nil
}

func (s *Service) validateQuickCreate(businessID string, req QuickCreateCustomerRequest) error {
	if strings.TrimSpace(req.FullName) == "" {
		return apperrors.BadRequest("full_name is required", nil)
	}
	if err := validateCustomerContact(req.Phone, req.Email); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateUpdate(businessID, branchID, customerID string, req UpdateCustomerRequest) error {
	if req.Phone != "" || req.Email != "" {
		if err := validateCustomerContact(req.Phone, req.Email); err != nil {
			return err
		}
		if err := s.validateUniqueContact(businessID, branchID, customerID, req.Phone, req.Email); err != nil {
			return err
		}
	}
	if err := validateGender(req.Gender); err != nil {
		return err
	}
	if req.DateOfBirth != "" && parseDatePointer(req.DateOfBirth) == nil {
		return apperrors.BadRequest("date_of_birth must use YYYY-MM-DD", nil)
	}
	if err := s.repo.ValidateTagIDs(businessID, branchID, uniqueStrings(req.TagIDs)); err != nil {
		return apperrors.BadRequest("invalid tag_ids", nil)
	}
	return nil
}

func (s *Service) validateUniqueContact(businessID, branchID, customerID, phone, email string) error {
	if strings.TrimSpace(phone) != "" {
		exists, err := s.repo.PhoneExists(businessID, branchID, strings.TrimSpace(phone), customerID)
		if err != nil {
			return apperrors.Internal("failed to validate phone")
		}
		if exists {
			return apperrors.Conflict("phone already exists", nil)
		}
	}
	if strings.TrimSpace(email) != "" {
		exists, err := s.repo.EmailExists(businessID, branchID, strings.ToLower(strings.TrimSpace(email)), customerID)
		if err != nil {
			return apperrors.Internal("failed to validate email")
		}
		if exists {
			return apperrors.Conflict("email already exists", nil)
		}
	}
	return nil
}

func (s *Service) generateCustomerCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	for i := 0; i < 10; i++ {
		code, err := s.repo.NextCustomerCode(tx, businessID, branchID)
		if err != nil {
			return "", err
		}
		exists, err := s.repo.CustomerCodeExists(tx, businessID, branchID, code)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "CUST-" + time.Now().UTC().Format("20060102150405"), nil
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
		return apperrors.Internal("failed to commit customer change")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "customers",
		EntityID:    entityID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func normalizeCustomerListQuery(query *CustomerListQuery) {
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

func normalizeLookupQuery(query *CustomerLookupQuery) {
	query.Search = strings.TrimSpace(query.Search)
	query.Phone = strings.TrimSpace(query.Phone)
	query.Email = strings.ToLower(strings.TrimSpace(query.Email))
	if query.Limit <= 0 {
		query.Limit = 10
	}
	if query.Limit > 20 {
		query.Limit = 20
	}
}

func validCustomerStatus(value string) bool {
	switch value {
	case "active", "inactive", "blocked":
		return true
	default:
		return false
	}
}

func validateGender(value string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	switch value {
	case "male", "female", "other", "prefer_not_to_say":
		return nil
	default:
		return apperrors.BadRequest("invalid gender", nil)
	}
}

func validateCustomerContact(phone, email string) error {
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
	return nil
}

func validateHexColor(value string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	ok, _ := regexp.MatchString(`^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`, strings.TrimSpace(value))
	if !ok {
		return apperrors.BadRequest("color must be a valid hex color", nil)
	}
	return nil
}

func parseDatePointer(value string) *time.Time {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return nil
	}
	return &parsed
}

func cleanCustomerStringPointer(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func derefCustomerString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func toCustomerResponse(customer Customer, tags []CustomerTagResponse) CustomerResponse {
	var dob *string
	if customer.DateOfBirth != nil {
		value := customer.DateOfBirth.Format("2006-01-02")
		dob = &value
	}
	return CustomerResponse{
		ID:           customer.ID,
		BusinessID:   customer.BusinessID,
		BranchID:     customer.BranchID,
		CustomerCode: customer.CustomerCode,
		FullName:     customer.FullName,
		Phone:        customer.Phone,
		Email:        customer.Email,
		DateOfBirth:  dob,
		Gender:       derefCustomerString(customer.Gender),
		AddressLine1: customer.AddressLine1,
		AddressLine2: customer.AddressLine2,
		City:         customer.City,
		State:        customer.State,
		Country:      customer.Country,
		PostalCode:   customer.PostalCode,
		Notes:        customer.Notes,
		Status:       customer.Status,
		Tags:         tags,
		CreatedAt:    customer.CreatedAt,
		UpdatedAt:    customer.UpdatedAt,
	}
}
