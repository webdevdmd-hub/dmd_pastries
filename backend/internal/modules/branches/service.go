package branches

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/inventory"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db            *gorm.DB
	repo          *Repository
	auditRepo     *audit.Repository
	inventoryRepo *inventory.Repository
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository, inventoryRepo ...*inventory.Repository) *Service {
	service := &Service{db: db, repo: repo, auditRepo: auditRepo}
	if len(inventoryRepo) > 0 {
		service.inventoryRepo = inventoryRepo[0]
	}
	return service
}

func (s *Service) ListBranches(currentUser *utils.AuthContext) ([]BranchResponse, error) {
	var (
		branches []Branch
		err      error
	)
	if currentUser.CanAccessAllBranches {
		branches, err = s.repo.ListByBusinessID(currentUser.BusinessID)
	} else {
		branches, err = s.repo.ListByBusinessIDAndIDs(currentUser.BusinessID, currentUser.AllowedBranchIDs)
	}
	if err != nil {
		return nil, apperrors.Internal("failed to list branches")
	}

	response := make([]BranchResponse, 0, len(branches))
	for _, branch := range branches {
		response = append(response, toBranchResponse(branch))
	}
	return response, nil
}

func (s *Service) GetBranch(currentUser *utils.AuthContext, branchID string) (*BranchResponse, error) {
	branch, err := s.repo.FindByIDAndBusinessID(branchID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("branch not found")
		}
		return nil, apperrors.Internal("failed to fetch branch")
	}
	if !currentUser.CanAccessBranch(branch.ID) {
		return nil, apperrors.Forbidden("branch access denied")
	}

	response := toBranchResponse(*branch)
	return &response, nil
}

func (s *Service) CreateBranch(currentUser *utils.AuthContext, req CreateBranchRequest, ipAddress, userAgent string) (*BranchResponse, error) {
	code := normalizeBranchCode(req.BranchCode, req.Code)
	if code == "" {
		return nil, apperrors.BadRequest("branch_code is required", nil)
	}
	exists, err := s.repo.ExistsByCodeAndBusinessID(code, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate branch code")
	}
	if exists {
		return nil, apperrors.Conflict("branch code already exists", nil)
	}
	if err := s.validateManager(currentUser.BusinessID, req.ManagerUserID); err != nil {
		return nil, err
	}

	branch := &Branch{
		ID:            utils.NewUUID(),
		BusinessID:    currentUser.BusinessID,
		BranchName:    strings.TrimSpace(req.Name),
		Name:          strings.TrimSpace(req.Name),
		Code:          code,
		Address:       strings.TrimSpace(req.AddressLine1),
		Phone:         strings.TrimSpace(req.Phone),
		Email:         strings.TrimSpace(req.Email),
		ManagerUserID: req.ManagerUserID,
		AddressLine1:  strings.TrimSpace(req.AddressLine1),
		AddressLine2:  strings.TrimSpace(req.AddressLine2),
		City:          strings.TrimSpace(req.City),
		Country:       strings.TrimSpace(req.Country),
		Timezone:      strings.TrimSpace(req.Timezone),
		IsDefault:     req.IsDefault,
		Status:        defaultBranchStatus(req.Status),
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if branch.IsDefault {
		if err := s.repo.ClearDefault(tx, currentUser.BusinessID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default branch")
		}
	}

	if err := s.repo.Create(tx, branch); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create branch")
	}

	if s.inventoryRepo != nil {
		if _, err := s.inventoryRepo.EnsureDefaultStockLocation(tx, currentUser.BusinessID, branch.ID, currentUser.UserID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to create default stock location")
		}
	}

	// Seed the branch's accounting configuration. Since migration 000092 the
	// chart of accounts, account mappings and payment accounts are all
	// branch-scoped, so a branch created without them cannot post a single
	// journal: the first sale either fails or resolves accounts from whichever
	// branch happens to match first.
	//
	// SeedDefaultAccountMappings seeds the chart of accounts itself, and both
	// seeders are idempotent, so re-running is harmless.
	if err := accounting.SeedDefaultAccountMappings(tx, currentUser.BusinessID, branch.ID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed branch chart of accounts")
	}
	if _, err := accounting.SeedDefaultPaymentAccountsForBusiness(
		tx, currentUser.BusinessID, currentUser.UserID,
		func(branchID string) bool { return branchID == branch.ID },
	); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed branch payment accounts")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		BranchID:    &branch.ID,
		EventType:   "branch.created",
		EntityType:  "branch",
		EntityID:    branch.ID,
		Summary:     "Branch created.",
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit branch creation")
	}

	response := toBranchResponse(*branch)
	return &response, nil
}

func (s *Service) UpdateBranch(currentUser *utils.AuthContext, branchID string, req UpdateBranchRequest, ipAddress, userAgent string) (*BranchResponse, error) {
	branch, err := s.repo.FindByIDAndBusinessID(branchID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("branch not found")
		}
		return nil, apperrors.Internal("failed to fetch branch")
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		name := strings.TrimSpace(req.Name)
		updates["name"] = name
		updates["branch_name"] = name
	}
	if req.BranchName != "" {
		name := strings.TrimSpace(req.BranchName)
		updates["name"] = name
		updates["branch_name"] = name
	}
	if req.Code != "" {
		code := normalizeBranchCode(req.BranchCode, req.Code)
		exists, err := s.repo.ExistsByCodeAndBusinessIDExcludingID(code, currentUser.BusinessID, branch.ID)
		if err != nil {
			return nil, apperrors.Internal("failed to validate branch code")
		}
		if exists {
			return nil, apperrors.Conflict("branch code already exists", nil)
		}
		updates["code"] = code
	}
	if req.BranchCode != "" && req.Code == "" {
		code := normalizeBranchCode(req.BranchCode)
		exists, err := s.repo.ExistsByCodeAndBusinessIDExcludingID(code, currentUser.BusinessID, branch.ID)
		if err != nil {
			return nil, apperrors.Internal("failed to validate branch code")
		}
		if exists {
			return nil, apperrors.Conflict("branch code already exists", nil)
		}
		updates["code"] = code
	}
	if req.Address != "" {
		updates["address"] = strings.TrimSpace(req.Address)
	}
	if req.Phone != "" {
		updates["phone"] = strings.TrimSpace(req.Phone)
	}
	if req.Email != "" {
		updates["email"] = strings.TrimSpace(req.Email)
	}
	if req.ManagerUserID != nil {
		if err := s.validateManager(currentUser.BusinessID, req.ManagerUserID); err != nil {
			return nil, err
		}
		updates["manager_user_id"] = *req.ManagerUserID
	}
	if req.AddressLine1 != "" {
		updates["address_line1"] = strings.TrimSpace(req.AddressLine1)
		updates["address"] = strings.TrimSpace(req.AddressLine1)
	}
	if req.AddressLine2 != "" {
		updates["address_line2"] = strings.TrimSpace(req.AddressLine2)
	}
	if req.City != "" {
		updates["city"] = strings.TrimSpace(req.City)
	}
	if req.Country != "" {
		updates["country"] = strings.TrimSpace(req.Country)
	}
	if req.Timezone != "" {
		updates["timezone"] = strings.TrimSpace(req.Timezone)
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.IsDefault != nil {
		if *req.IsDefault && branch.Status != "active" {
			return nil, apperrors.BadRequest("only active branches can be default", nil)
		}
		updates["is_default"] = *req.IsDefault
	}
	if len(updates) == 0 {
		return nil, apperrors.BadRequest("no updatable fields provided", nil)
	}

	updates["updated_at"] = time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.ClearDefault(tx, currentUser.BusinessID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default branch")
		}
	}
	if err := s.repo.UpdateByBusinessIDTx(tx, branch.ID, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.writeAuditTx(tx, currentUser, "branch.updated", branch.ID, ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit branch update")
	}

	updated, err := s.repo.FindByIDAndBusinessID(branch.ID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload branch")
	}
	response := toBranchResponse(*updated)
	return &response, nil
}

func (s *Service) UpdateBranchStatus(currentUser *utils.AuthContext, branchID string, req UpdateBranchStatusRequest, ipAddress, userAgent string) (*BranchResponse, error) {
	if err := s.repo.UpdateByBusinessID(branchID, currentUser.BusinessID, map[string]interface{}{
		"status":     req.Status,
		"updated_at": time.Now().UTC(),
	}); err != nil {
		return nil, err
	}

	if err := s.writeAudit(currentUser, "branch.updated", branchID, ipAddress, userAgent); err != nil {
		return nil, err
	}

	updated, err := s.repo.FindByIDAndBusinessID(branchID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("branch not found")
		}
		return nil, apperrors.Internal("failed to reload branch")
	}
	response := toBranchResponse(*updated)
	return &response, nil
}

func (s *Service) writeAudit(currentUser *utils.AuthContext, eventType, referenceID, ipAddress, userAgent string) error {
	return s.writeAuditTx(s.db, currentUser, eventType, referenceID, ipAddress, userAgent)
}

func (s *Service) writeAuditTx(tx *gorm.DB, currentUser *utils.AuthContext, eventType, referenceID, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "branch",
		EntityID:    referenceID,
		Summary:     "Branch settings changed.",
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create audit log")
	}
	return nil
}

func toBranchResponse(branch Branch) BranchResponse {
	return BranchResponse{
		ID:            branch.ID,
		BusinessID:    branch.BusinessID,
		Name:          firstNonEmpty(branch.Name, branch.BranchName),
		Code:          branch.Code,
		BranchCode:    branch.Code,
		Phone:         branch.Phone,
		Email:         branch.Email,
		ManagerUserID: branch.ManagerUserID,
		AddressLine1:  firstNonEmpty(branch.AddressLine1, branch.Address),
		AddressLine2:  branch.AddressLine2,
		City:          branch.City,
		Country:       branch.Country,
		Timezone:      branch.Timezone,
		IsDefault:     branch.IsDefault,
		Status:        branch.Status,
		CreatedAt:     branch.CreatedAt,
		UpdatedAt:     branch.UpdatedAt,
	}
}

func normalizeBranchCode(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return strings.ToUpper(value)
		}
	}
	return ""
}

func (s *Service) validateManager(businessID string, managerUserID *string) error {
	if managerUserID == nil || *managerUserID == "" {
		return nil
	}

	exists, err := s.repo.UserExistsByIDAndBusinessID(*managerUserID, businessID)
	if err != nil {
		return apperrors.Internal("failed to validate manager user")
	}
	if !exists {
		return apperrors.BadRequest("invalid manager_user_id", nil)
	}
	return nil
}

func defaultBranchStatus(status string) string {
	if status == "" {
		return "active"
	}
	return status
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
