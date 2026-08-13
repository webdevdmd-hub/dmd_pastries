package businesses

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/branches"
	"pastries-pos/internal/modules/roles"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db         *gorm.DB
	repo       *Repository
	branchRepo *branches.Repository
	roleRepo   *roles.Repository
	auditRepo  *audit.Repository
}

func NewService(
	db *gorm.DB,
	repo *Repository,
	branchRepo *branches.Repository,
	roleRepo *roles.Repository,
	auditRepo *audit.Repository,
) *Service {
	return &Service{
		db:         db,
		repo:       repo,
		branchRepo: branchRepo,
		roleRepo:   roleRepo,
		auditRepo:  auditRepo,
	}
}

func (s *Service) GetBusiness(currentUser *utils.AuthContext) (*BusinessResponse, error) {
	business, err := s.repo.FindByID(currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("business not found")
		}
		return nil, apperrors.Internal("failed to load business")
	}
	response := toBusinessResponse(*business)
	return &response, nil
}

func (s *Service) UpdateBusiness(currentUser *utils.AuthContext, req UpdateBusinessRequest, ipAddress, userAgent string) (*BusinessResponse, error) {
	updates := map[string]interface{}{}
	if req.BusinessName != "" {
		updates["business_name"] = strings.TrimSpace(req.BusinessName)
	}
	if req.Currency != "" {
		updates["currency"] = strings.ToUpper(strings.TrimSpace(req.Currency))
	}
	if req.Timezone != "" {
		updates["timezone"] = strings.TrimSpace(req.Timezone)
	}
	if req.VATNumber != "" {
		updates["vat_number"] = strings.TrimSpace(req.VATNumber)
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if len(updates) == 0 {
		return nil, apperrors.BadRequest("no updatable fields provided", nil)
	}

	updates["updated_at"] = time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.UpdateByID(tx, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "business.updated",
		EntityType:  "business",
		EntityID:    currentUser.BusinessID,
		Summary:     "Business profile updated.",
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit business update")
	}

	return s.GetBusiness(currentUser)
}

func (s *Service) GetSettings(currentUser *utils.AuthContext) (*BusinessSettingsResponse, error) {
	settings, err := s.repo.EnsureSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load business settings")
	}
	response := toSettingsResponse(*settings)
	return &response, nil
}

func (s *Service) UpdateSettings(currentUser *utils.AuthContext, req UpdateBusinessSettingsRequest, ipAddress, userAgent string) (*BusinessSettingsResponse, error) {
	settings, err := s.repo.EnsureSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load business settings")
	}

	updates := map[string]interface{}{}
	if req.ReceiptFooter != nil {
		updates["receipt_footer"] = strings.TrimSpace(*req.ReceiptFooter)
	}
	if req.AllowNegativeStock != nil {
		updates["allow_negative_stock"] = *req.AllowNegativeStock
	}
	if req.DefaultTaxRate != nil {
		updates["default_tax_rate"] = *req.DefaultTaxRate
	}
	if req.PriceIncludesTax != nil {
		updates["price_includes_tax"] = *req.PriceIncludesTax
	}
	if req.DefaultTaxMode != nil {
		mode := strings.TrimSpace(*req.DefaultTaxMode)
		if mode != "inclusive" && mode != "exclusive" && mode != "no_tax" {
			return nil, apperrors.BadRequest("default_tax_mode must be inclusive, exclusive, or no_tax", nil)
		}
		updates["default_tax_mode"] = mode
	}
	if req.LowStockAlert != nil {
		updates["low_stock_alert"] = *req.LowStockAlert
	}
	if req.DefaultLanguage != nil {
		updates["default_language"] = strings.TrimSpace(*req.DefaultLanguage)
	}
	if req.DateFormat != nil {
		updates["date_format"] = strings.TrimSpace(*req.DateFormat)
	}
	if len(updates) == 0 {
		response := toSettingsResponse(*settings)
		return &response, nil
	}

	updates["updated_at"] = time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.UpdateSettings(tx, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update business settings")
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "settings.updated",
		EntityType:  "settings",
		EntityID:    settings.ID,
		Summary:     "Business settings updated.",
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit settings update")
	}

	return s.GetSettings(currentUser)
}

func (s *Service) GetOnboardingStatus(currentUser *utils.AuthContext) (*OnboardingStatusResponse, error) {
	business, err := s.repo.FindByID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load business")
	}
	branchCount, err := s.branchRepo.CountActiveByBusinessID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load branches")
	}
	roleCount, err := s.roleRepo.CountByBusinessID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load roles")
	}
	userCount, err := s.repo.CountActiveUsers(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load users")
	}
	settings, err := s.repo.EnsureSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load settings")
	}
	currentBranchID, _ := s.repo.FindUserBranchID(currentUser.UserID, currentUser.BusinessID)

	steps := []OnboardingStepResponse{
		{Key: "business_profile", Label: "Business profile completed", Complete: business.BusinessName != "" && business.Currency != "" && business.Timezone != "", Required: true},
		{Key: "default_roles", Label: "Default roles available", Complete: roleCount > 0, Required: true},
		{Key: "first_branch", Label: "At least one active branch exists", Complete: branchCount > 0, Required: true},
		{Key: "business_settings", Label: "Business settings initialized", Complete: settings.ID != "", Required: true},
		{Key: "staff_ready", Label: "At least one active user exists", Complete: userCount > 0, Required: true},
	}

	completed := 0
	for _, step := range steps {
		if step.Complete {
			completed++
		}
	}

	return &OnboardingStatusResponse{
		BusinessID:        currentUser.BusinessID,
		Complete:          completed == len(steps),
		CompletionPercent: int(float64(completed) / float64(len(steps)) * 100),
		CurrentBranchID:   currentBranchID,
		Steps:             steps,
	}, nil
}

func (s *Service) SwitchBranch(currentUser *utils.AuthContext, req SwitchBranchRequest, ipAddress, userAgent string) (*SwitchBranchResponse, error) {
	branch, err := s.branchRepo.FindByIDAndBusinessID(req.BranchID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid branch_id", nil)
		}
		return nil, apperrors.Internal("failed to load branch")
	}
	if branch.Status != "active" {
		return nil, apperrors.BadRequest("branch is inactive", nil)
	}
	if !currentUser.CanAccessBranch(branch.ID) {
		return nil, apperrors.Forbidden("branch access denied")
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.UpdateUserCurrentBranch(tx, currentUser.UserID, currentUser.BusinessID, branch.ID); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &currentUser.UserID,
		EventType:    "user.branch_switched",
		EntityType:   "user",
		EntityID:     currentUser.UserID,
		Summary:      "User switched current branch.",
		Metadata:     map[string]interface{}{"branch_id": branch.ID},
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit branch switch")
	}

	return &SwitchBranchResponse{
		UserID:          currentUser.UserID,
		BusinessID:      currentUser.BusinessID,
		CurrentBranchID: branch.ID,
	}, nil
}

func toBusinessResponse(business Business) BusinessResponse {
	return BusinessResponse{
		ID:           business.ID,
		BusinessName: business.BusinessName,
		OwnerUserID:  business.OwnerUserID,
		Currency:     business.Currency,
		Timezone:     business.Timezone,
		VATNumber:    business.VATNumber,
		Status:       business.Status,
		CreatedAt:    business.CreatedAt,
		UpdatedAt:    business.UpdatedAt,
	}
}

func toSettingsResponse(settings BusinessSettings) BusinessSettingsResponse {
	return BusinessSettingsResponse{
		ID:                 settings.ID,
		BusinessID:         settings.BusinessID,
		ReceiptFooter:      settings.ReceiptFooter,
		AllowNegativeStock: settings.AllowNegativeStock,
		DefaultTaxRate:     settings.DefaultTaxRate,
		PriceIncludesTax:   settings.PriceIncludesTax,
		DefaultTaxMode:     settings.DefaultTaxMode,
		LowStockAlert:      settings.LowStockAlert,
		DefaultLanguage:    settings.DefaultLanguage,
		DateFormat:         settings.DateFormat,
		CreatedAt:          settings.CreatedAt,
		UpdatedAt:          settings.UpdatedAt,
	}
}
