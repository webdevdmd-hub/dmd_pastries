package auth

import (
	"log"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/config"
	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/branches"
	"pastries-pos/internal/modules/businesses"
	"pastries-pos/internal/modules/masterdata"
	"pastries-pos/internal/modules/permissions"
	"pastries-pos/internal/modules/roles"
	"pastries-pos/internal/modules/settings"
	"pastries-pos/internal/modules/subscriptions"
	"pastries-pos/internal/modules/users"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db               *gorm.DB
	cfg              config.Config
	appwriteClient   *utils.AppwriteClient
	repo             *Repository
	userRepo         *users.Repository
	businessRepo     *businesses.Repository
	roleRepo         *roles.Repository
	permissionRepo   *permissions.Repository
	subscriptionRepo *subscriptions.Repository
	auditRepo        *audit.Repository
}

type defaultRolePreset struct {
	RoleName        string
	Description     string
	IsSystemDefault bool
	PermissionKeys  []string
}

type userBranchScope struct {
	CurrentBranchID      *string
	AssignedBranchID     *string
	AllowedBranchIDs     []string
	CanAccessAllBranches bool
}

func NewService(
	db *gorm.DB,
	cfg config.Config,
	appwriteClient *utils.AppwriteClient,
	repo *Repository,
	userRepo *users.Repository,
	businessRepo *businesses.Repository,
	roleRepo *roles.Repository,
	permissionRepo *permissions.Repository,
	subscriptionRepo *subscriptions.Repository,
	auditRepo *audit.Repository,
) *Service {
	return &Service{
		db:               db,
		cfg:              cfg,
		appwriteClient:   appwriteClient,
		repo:             repo,
		userRepo:         userRepo,
		businessRepo:     businessRepo,
		roleRepo:         roleRepo,
		permissionRepo:   permissionRepo,
		subscriptionRepo: subscriptionRepo,
		auditRepo:        auditRepo,
	}
}

func (s *Service) RegisterOwner(req RegisterOwnerRequest, ipAddress, userAgent string) (*RegisterOwnerResponse, error) {
	if !utils.PasswordsMatch(req.Password, req.ConfirmPassword) {
		return nil, apperrors.BadRequest("password and confirm_password must match", nil)
	}

	appwriteUserID, err := s.appwriteClient.CreateUser(req.Email, req.Password, req.FullName, req.Phone)
	if err != nil {
		message, details := utils.FriendlyAppwriteCreateUserError(err)
		return nil, apperrors.BadRequest(message, details)
	}
	registrationCommitted := false
	defer func() {
		if !registrationCommitted {
			_ = s.appwriteClient.DeleteUser(appwriteUserID)
		}
	}()

	now := time.Now().UTC()
	trialEndsAt := now.AddDate(0, 0, s.cfg.DefaultTrialDays)
	businessID := utils.NewUUID()
	branchID := utils.NewUUID()
	roleID := utils.NewUUID()
	userID := utils.NewUUID()

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	business := &businesses.Business{
		ID:           businessID,
		BusinessName: req.BusinessName,
		Currency:     s.cfg.DefaultBusinessCurrency,
		Timezone:     s.cfg.DefaultBusinessTimezone,
		Status:       "active",
	}
	if err := s.businessRepo.Create(tx, business); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create business")
	}

	defaultBranch := &branches.Branch{
		ID:         branchID,
		BusinessID: businessID,
		BranchName: "Main Branch",
		Name:       "Main Branch",
		Code:       "MAIN",
		Phone:      req.Phone,
		Email:      strings.ToLower(req.Email),
		Timezone:   s.cfg.DefaultBusinessTimezone,
		IsDefault:  true,
		Status:     "active",
	}
	if err := tx.Create(defaultBranch).Error; err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create default branch")
	}

	permissionsList, err := s.permissionRepo.EnsureDefaults(tx)
	if err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed permissions")
	}

	permissionByKey := make(map[string]permissions.Permission, len(permissionsList))
	for _, permission := range permissionsList {
		permissionByKey[permission.PermissionKey] = permission
	}

	rolePresets := defaultRolePresets()
	for _, preset := range rolePresets {
		currentRoleID := utils.NewUUID()
		if preset.RoleName == "Admin" {
			currentRoleID = roleID
		}

		role := &roles.Role{
			ID:              currentRoleID,
			BusinessID:      &businessID,
			RoleName:        preset.RoleName,
			Description:     preset.Description,
			IsSystemDefault: preset.IsSystemDefault,
		}
		if err := s.roleRepo.Create(tx, role); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to create default roles")
		}

		rolePermissions := make([]roles.RolePermission, 0, len(preset.PermissionKeys))
		for _, permissionKey := range preset.PermissionKeys {
			permission, exists := permissionByKey[permissionKey]
			if !exists {
				tx.Rollback()
				return nil, apperrors.Internal("failed to map default role permissions")
			}

			rolePermissions = append(rolePermissions, roles.RolePermission{
				ID:           utils.NewUUID(),
				RoleID:       currentRoleID,
				PermissionID: permission.ID,
				Allowed:      true,
			})
		}

		if err := s.roleRepo.AttachPermissions(tx, rolePermissions); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to attach default role permissions")
		}
	}

	localUser := &users.User{
		ID:                   userID,
		AppwriteUserID:       appwriteUserID,
		BusinessID:           businessID,
		BranchID:             &branchID,
		CurrentBranchID:      &branchID,
		RoleID:               roleID,
		FullName:             req.FullName,
		Email:                strings.ToLower(req.Email),
		Phone:                req.Phone,
		Status:               "active",
		CanAccessAllBranches: true,
	}
	if err := s.userRepo.Create(tx, localUser); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create local user")
	}
	if err := s.userRepo.EnsureBranchAccess(tx, businessID, userID, branchID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to grant owner branch access")
	}

	if err := s.businessRepo.UpdateOwnerUserID(tx, businessID, userID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update business owner")
	}

	if _, err := settings.EnsureDefaultCompanySettings(tx, settings.DefaultCompanySettingsInput{
		BusinessID:          businessID,
		BusinessDisplayName: req.BusinessName,
		Phone:               req.Phone,
		Email:               strings.ToLower(req.Email),
		Currency:            s.cfg.DefaultBusinessCurrency,
		Timezone:            s.cfg.DefaultBusinessTimezone,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create company settings")
	}

	if err := masterdata.SeedDefaults(tx, businessID, branchID); err != nil {
		tx.Rollback()
		log.Printf("owner registration master data seed failed: business_id=%s branch_id=%s error=%v", businessID, branchID, err)
		return nil, apperrors.Internal("failed to seed master data defaults")
	}

	if err := settings.EnsureDefaultTaxRates(tx, businessID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed default tax rates")
	}

	if err := settings.EnsureDefaultPaymentMethods(tx, businessID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed default payment methods")
	}

	if err := settings.EnsureDefaultSalesChannels(tx, businessID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed default sales channels")
	}

	if err := accounting.SeedDefaultChartOfAccounts(tx, businessID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed chart of accounts")
	}

	if _, err := accounting.SeedDefaultPaymentAccountsForBusiness(tx, businessID, userID, nil); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to seed default payment accounts")
	}

	subscription := &subscriptions.Subscription{
		ID:          utils.NewUUID(),
		BusinessID:  businessID,
		PlanType:    "trial",
		Status:      "trialing",
		UserLimit:   5,
		BranchLimit: 1,
		TrialEndsAt: &trialEndsAt,
		RenewalDate: &trialEndsAt,
	}
	if err := s.subscriptionRepo.Create(tx, subscription); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create subscription")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   businessID,
		ActorUserID:  userID,
		TargetUserID: &userID,
		EventType:    "user.created",
		EntityType:   "user",
		EntityID:     userID,
		Summary:      "Owner user registered.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit owner registration")
	}
	registrationCommitted = true

	return &RegisterOwnerResponse{
		BusinessID:         businessID,
		UserID:             userID,
		AppwriteUserID:     appwriteUserID,
		RoleID:             roleID,
		SubscriptionStatus: subscription.Status,
	}, nil
}

func defaultRolePresets() []defaultRolePreset {
	return []defaultRolePreset{
		{
			RoleName:        "Admin",
			Description:     "Default business administrator role",
			IsSystemDefault: true,
			PermissionKeys:  allPermissionKeys(),
		},
		{
			RoleName:        "Cashier",
			Description:     "Counter staff for daily sales operations",
			IsSystemDefault: true,
			PermissionKeys: []string{
				"products.view",
				"customers.view",
				"customers.create",
				"customers.quick_create",
				"orders.view",
				"orders.create",
				"orders.payments.manage",
				"pos.view",
				"pos.sell",
				"pos.checkout",
				"pos.discount.apply",
				"pos.hold_sale",
				"pos.resume_sale",
				"pos.cancel_held_sale",
				"payments.view",
				"payments.add",
				"payments.methods.view",
				"sales_returns.view",
				"sales_returns.create",
				"dashboard.view",
			},
		},
		{
			RoleName:        "Manager",
			Description:     "Operational manager with broader oversight",
			IsSystemDefault: true,
			PermissionKeys: []string{
				"users.view",
				"users.create",
				"users.edit",
				"users.status.update",
				"users.invite",
				"users.invitation.resend",
				"users.invitation.cancel",
				"users.activity.view",
				"roles.view",
				"roles.create",
				"roles.edit",
				"roles.delete",
				"roles.permissions.view",
				"roles.permissions.update",
				"branches.view",
				"branches.create",
				"branches.edit",
				"branches.status.update",
				"branches.switch",
				"branches.access.manage",
				"settings.view",
				"settings.company.update",
				"settings.tax_rates.manage",
				"settings.payment_methods.manage",
				"settings.receipt.update",
				"master_data.view",
				"master_data.units.manage",
				"master_data.product_categories.manage",
				"master_data.ingredient_categories.manage",
				"master_data.packaging_categories.manage",
				"master_data.order_statuses.manage",
				"master_data.payment_statuses.manage",
				"pos.view",
				"pos.sell",
				"pos.checkout",
				"pos.discount.apply",
				"pos.hold_sale",
				"pos.resume_sale",
				"pos.cancel_held_sale",
				"pos.refund",
				"pos.void",
				"sales_returns.view",
				"sales_returns.create",
				"sales_returns.edit",
				"sales_returns.post",
				"sales_returns.cancel",
				"sales_returns.refund",
				"sales_returns.manage",
				"products.view",
				"products.create",
				"products.edit",
				"products.delete",
				"products.status.update",
				"products.variants.manage",
				"products.images.manage",
				"customers.view",
				"customers.create",
				"customers.edit",
				"customers.delete",
				"customers.status.update",
				"customers.notes.manage",
				"customers.tags.manage",
				"customers.quick_create",
				"orders.view",
				"orders.create",
				"orders.edit",
				"orders.delete",
				"orders.status.update",
				"orders.payments.manage",
				"orders.production.assign",
				"orders.packaging.manage",
				"inventory.view",
				"inventory.opening_stock",
				"inventory.adjust",
				"inventory.movements.view",
				"inventory.low_stock.view",
				"inventory.expiry.view",
				"inventory.expiry_batches.manage",
				"inventory.locations.manage",
				"inventory.transfer.create",
				"inventory.transfer.complete",
				"inventory.transfer.cancel",
				"stock_movements.view",
				"stock_movements.manual_create",
				"stock_movements.reverse",
				"stock_movements.audit.view",
				"stock_movements.summary.view",
				"ingredients.view",
				"ingredients.create",
				"ingredients.edit",
				"ingredients.delete",
				"ingredients.status.update",
				"suppliers.view",
				"suppliers.create",
				"suppliers.edit",
				"suppliers.delete",
				"suppliers.status.update",
				"suppliers.contacts.manage",
				"suppliers.notes.manage",
				"suppliers.lookup",
				"purchasing.view",
				"purchasing.orders.create",
				"purchasing.orders.edit",
				"purchasing.orders.delete",
				"purchasing.orders.status.update",
				"purchasing.invoices.create",
				"purchasing.invoices.edit",
				"purchasing.invoices.post",
				"purchasing.invoices.cancel",
				"purchasing.receipts.create",
				"purchasing.receipts.post",
				"purchasing.receipts.cancel",
				"purchasing.returns.view",
				"purchasing.returns.create",
				"purchasing.returns.edit",
				"purchasing.returns.post",
				"purchasing.returns.cancel",
				"purchasing.returns.manage",
				"purchasing.receive_stock",
				"packaging.view",
				"packaging.create",
				"packaging.edit",
				"packaging.delete",
				"packaging.status.update",
				"packaging.usage_rules.manage",
				"recipes.view",
				"recipes.create",
				"recipes.edit",
				"recipes.delete",
				"recipes.status.update",
				"recipes.ingredients.manage",
				"recipes.packaging.manage",
				"recipes.cost.recalculate",
				"recipes.versions.create",
				"manufacturing.view",
				"manufacturing.batches.create",
				"manufacturing.batches.edit",
				"manufacturing.batches.start",
				"manufacturing.batches.consume",
				"manufacturing.batches.produce",
				"manufacturing.batches.wastage",
				"manufacturing.batches.complete",
				"manufacturing.batches.cancel",
				"reports.view",
				"reports.sales.view",
				"reports.inventory.view",
				"reports.payments.view",
				"reports.production.view",
				"accounting.view",
				"accounting.accounts.manage",
				"accounting.journal_entries.manage",
				"expenses.view",
				"expenses.create",
				"expenses.edit",
				"expenses.delete",
				"expenses.manage",
				"dashboard.view",
				"audit_logs.view",
			},
		},
		{
			RoleName:        "Inventory Clerk",
			Description:     "Stock-focused staff role for products and inventory",
			IsSystemDefault: true,
			PermissionKeys: []string{
				"master_data.view",
				"branches.view",
				"products.view",
				"products.create",
				"products.edit",
				"products.status.update",
				"products.variants.manage",
				"inventory.view",
				"inventory.opening_stock",
				"inventory.adjust",
				"inventory.movements.view",
				"inventory.low_stock.view",
				"inventory.expiry.view",
				"inventory.expiry_batches.manage",
				"inventory.locations.manage",
				"inventory.transfer.create",
				"inventory.transfer.complete",
				"inventory.transfer.cancel",
				"stock_movements.view",
				"stock_movements.manual_create",
				"stock_movements.reverse",
				"stock_movements.audit.view",
				"stock_movements.summary.view",
				"ingredients.view",
				"ingredients.create",
				"ingredients.edit",
				"ingredients.status.update",
				"suppliers.view",
				"suppliers.create",
				"suppliers.edit",
				"suppliers.lookup",
				"purchasing.view",
				"purchasing.orders.create",
				"purchasing.orders.edit",
				"purchasing.invoices.create",
				"purchasing.invoices.edit",
				"purchasing.receipts.create",
				"purchasing.receipts.post",
				"purchasing.returns.view",
				"purchasing.returns.create",
				"purchasing.returns.edit",
				"purchasing.returns.post",
				"purchasing.returns.cancel",
				"purchasing.receive_stock",
				"packaging.view",
				"packaging.create",
				"packaging.edit",
				"packaging.status.update",
				"recipes.view",
				"recipes.create",
				"recipes.edit",
				"recipes.ingredients.manage",
				"recipes.packaging.manage",
				"recipes.cost.recalculate",
				"manufacturing.view",
				"manufacturing.batches.create",
				"manufacturing.batches.edit",
				"manufacturing.batches.start",
				"manufacturing.batches.consume",
				"manufacturing.batches.complete",
				"orders.view",
				"dashboard.view",
			},
		},
	}
}

func DefaultRolePermissionPresets() map[string][]string {
	presets := defaultRolePresets()
	result := make(map[string][]string, len(presets))
	for _, preset := range presets {
		result[preset.RoleName] = preset.PermissionKeys
	}
	return result
}

func allPermissionKeys() []string {
	seeds := permissions.DefaultSeeds()
	keys := make([]string, 0, len(seeds))
	for _, seed := range seeds {
		keys = append(keys, seed.PermissionKey)
	}
	return keys
}

func (s *Service) LoginSync(jwt, ipAddress, userAgent string) (interface{}, error) {
	identity, err := s.appwriteClient.VerifyJWT(jwt)
	if err != nil {
		return nil, apperrors.Unauthorized("invalid Appwrite token")
	}

	if err := s.ensureEmailVerification(identity); err != nil {
		return nil, err
	}
	if s.isSuperAdminIdentity(identity) {
		return s.platformAdminProfile(identity), nil
	}

	return s.syncProfile(identity, ipAddress, userAgent)
}

func (s *Service) Me(currentUser *utils.AuthContext) (interface{}, error) {
	if currentUser != nil && currentUser.IsPlatformAdmin {
		return &PlatformAdminProfileResponse{
			AccountType:      "platform_admin",
			AppwriteUserID:   currentUser.AppwriteUserID,
			FullName:         currentUser.FullName,
			Email:            currentUser.Email,
			EmailVerified:    true,
			Permissions:      []string{"super_admin.access"},
			SuperAdminStatus: "active",
		}, nil
	}

	return s.buildProfileByUserID(currentUser.UserID, currentUser.BusinessID)
}

func (s *Service) RequestPasswordReset(req PasswordResetRequest) error {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if err := s.appwriteClient.CreatePasswordRecovery(email, s.cfg.PasswordResetURL); err != nil {
		return apperrors.BadRequest("failed to request password reset", err.Error())
	}
	return nil
}

func (s *Service) CompletePasswordReset(req PasswordResetCompleteRequest) error {
	if !utils.PasswordsMatch(req.Password, req.ConfirmPassword) {
		return apperrors.BadRequest("password and confirm_password must match", nil)
	}
	if err := s.appwriteClient.CompletePasswordRecovery(req.UserID, req.Secret, req.Password); err != nil {
		return apperrors.BadRequest("failed to complete password reset", err.Error())
	}
	return nil
}

func (s *Service) AuthenticateToken(token string) (*utils.AuthContext, error) {
	identity, err := s.appwriteClient.VerifyJWT(token)
	if err != nil {
		return nil, apperrors.Unauthorized("invalid Appwrite token")
	}
	if err := s.ensureEmailVerification(identity); err != nil {
		return nil, err
	}
	if s.isSuperAdminIdentity(identity) {
		return &utils.AuthContext{
			UserID:               identity.ID,
			AppwriteUserID:       identity.ID,
			FullName:             identity.Name,
			Email:                strings.ToLower(strings.TrimSpace(identity.Email)),
			IsPlatformAdmin:      true,
			CanAccessAllBranches: true,
			Permissions:          []string{"super_admin.access"},
		}, nil
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start auth transaction")
	}

	user, err := s.resolveLocalUserForIdentity(tx, identity)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.activateInvitedUser(tx, user); err != nil {
		tx.Rollback()
		return nil, err
	}
	if user.Status != "active" {
		tx.Rollback()
		return nil, apperrors.Forbidden("user is inactive")
	}

	if user.EmailVerified != identity.EmailVerified {
		if err := s.userRepo.UpdateEmailVerified(tx, user.ID, identity.EmailVerified); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to sync email verification status")
		}
		user.EmailVerified = identity.EmailVerified
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit auth transaction")
	}

	permissionKeys, err := s.roleRepo.GetPermissionKeysByRoleID(user.RoleID)
	if err != nil {
		return nil, apperrors.Internal("failed to load permissions")
	}

	branchScope, err := s.userBranchScope(user)
	if err != nil {
		return nil, err
	}

	return &utils.AuthContext{
		UserID:               user.ID,
		AppwriteUserID:       user.AppwriteUserID,
		BusinessID:           user.BusinessID,
		RoleID:               user.RoleID,
		RoleName:             user.Role.RoleName,
		FullName:             user.FullName,
		Email:                user.Email,
		CurrentBranchID:      branchScope.CurrentBranchID,
		AssignedBranchID:     branchScope.AssignedBranchID,
		AllowedBranchIDs:     branchScope.AllowedBranchIDs,
		CanAccessAllBranches: branchScope.CanAccessAllBranches,
		Permissions:          permissionKeys,
	}, nil
}

func (s *Service) syncProfile(identity *utils.AppwriteIdentity, ipAddress, userAgent string) (*AuthProfileResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	user, err := s.resolveLocalUserForIdentity(tx, identity)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.activateInvitedUser(tx, user); err != nil {
		tx.Rollback()
		return nil, err
	}
	if user.Status != "active" {
		tx.Rollback()
		return nil, apperrors.Forbidden("user is inactive")
	}

	now := time.Now().UTC()
	if err := s.userRepo.UpdateAuthSync(tx, user.ID, identity.EmailVerified, now); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update auth sync state")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   user.BusinessID,
		ActorUserID:  user.ID,
		TargetUserID: &user.ID,
		EventType:    "auth.login",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "User login synced.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create login audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit login sync")
	}

	return s.buildProfileByUserID(user.ID, user.BusinessID)
}

func (s *Service) resolveLocalUserForIdentity(tx *gorm.DB, identity *utils.AppwriteIdentity) (*users.User, error) {
	var user users.User
	err := tx.Preload("Role").
		Where("appwrite_user_id = ?", identity.ID).
		First(&user).Error
	if err == nil {
		return &user, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, apperrors.Internal("failed to load local user")
	}

	email := strings.ToLower(strings.TrimSpace(identity.Email))
	if email == "" {
		return nil, apperrors.Unauthorized("authenticated Appwrite user is not linked to a local employee account")
	}

	var matches []users.User
	if err := tx.Preload("Role").
		Where("LOWER(email) = ?", email).
		Order("created_at DESC").
		Limit(2).
		Find(&matches).Error; err != nil {
		return nil, apperrors.Internal("failed to load local user")
	}
	if len(matches) == 0 {
		user, err := s.provisionInvitedUserForIdentity(tx, identity)
		if err != nil {
			return nil, err
		}
		if user != nil {
			return user, nil
		}
		return nil, apperrors.Unauthorized("authenticated Appwrite user is not registered in this business")
	}
	if len(matches) > 1 {
		return nil, apperrors.Unauthorized("multiple local users found for this email; contact support")
	}

	user = matches[0]
	if user.AppwriteUserID != identity.ID {
		if err := s.userRepo.UpdateAppwriteUserID(tx, user.ID, identity.ID); err != nil {
			return nil, apperrors.Internal("failed to relink local user")
		}
		user.AppwriteUserID = identity.ID
	}

	return &user, nil
}

func (s *Service) activateInvitedUser(tx *gorm.DB, user *users.User) error {
	if user == nil || user.Status != "invited" {
		return nil
	}
	if err := s.userRepo.UpdateByBusinessIDTx(tx, user.ID, user.BusinessID, map[string]interface{}{"status": "active", "updated_at": time.Now().UTC()}); err != nil {
		return apperrors.Internal("failed to activate invited user")
	}
	user.Status = "active"
	return nil
}

func (s *Service) provisionInvitedUserForIdentity(tx *gorm.DB, identity *utils.AppwriteIdentity) (*users.User, error) {
	email := strings.ToLower(strings.TrimSpace(identity.Email))
	if email == "" {
		return nil, nil
	}

	var invitations []users.UserInvitation
	if err := tx.
		Where("LOWER(email) = ? AND status = ?", email, "pending").
		Order("created_at DESC").
		Limit(2).
		Find(&invitations).Error; err != nil {
		return nil, apperrors.Internal("failed to load pending invitation")
	}
	if len(invitations) == 0 {
		return nil, nil
	}
	if len(invitations) > 1 {
		return nil, apperrors.Unauthorized("multiple pending invitations found for this email; contact support")
	}

	invite := invitations[0]
	now := time.Now().UTC()
	if now.After(invite.ExpiresAt) {
		if err := tx.Model(&users.UserInvitation{}).Where("id = ?", invite.ID).Updates(map[string]interface{}{"status": "expired", "updated_at": now}).Error; err != nil {
			return nil, apperrors.Internal("failed to expire invitation")
		}
		return nil, apperrors.Unauthorized("invitation has expired")
	}

	user := &users.User{
		ID:              utils.NewUUID(),
		AppwriteUserID:  identity.ID,
		BusinessID:      invite.BusinessID,
		BranchID:        invite.BranchID,
		CurrentBranchID: invite.BranchID,
		RoleID:          invite.RoleID,
		FullName:        firstNonEmptyString(strings.TrimSpace(identity.Name), invite.FullName),
		Email:           email,
		Phone:           firstNonEmptyString(strings.TrimSpace(identity.Phone), invite.Phone),
		Status:          "active",
		EmailVerified:   identity.EmailVerified,
	}
	if err := s.userRepo.Create(tx, user); err != nil {
		return nil, apperrors.Internal("failed to create invited local user")
	}
	if user.BranchID != nil {
		if err := s.userRepo.EnsureBranchAccess(tx, user.BusinessID, user.ID, *user.BranchID); err != nil {
			return nil, apperrors.Internal("failed to grant branch access")
		}
	}
	if err := tx.Model(&users.UserInvitation{}).Where("id = ?", invite.ID).Updates(map[string]interface{}{
		"status":      "accepted",
		"accepted_at": now,
		"updated_at":  now,
	}).Error; err != nil {
		return nil, apperrors.Internal("failed to accept invitation")
	}
	if err := tx.Preload("Role").Where("id = ?", user.ID).First(user).Error; err != nil {
		return nil, apperrors.Internal("failed to load invited local user")
	}

	return user, nil
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (s *Service) LogoutSync(currentUser *utils.AuthContext, ipAddress, userAgent string) error {
	if currentUser == nil {
		return apperrors.Unauthorized("missing authenticated user")
	}
	if currentUser.IsPlatformAdmin {
		return nil
	}

	if err := s.auditRepo.CreateActivity(s.db, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &currentUser.UserID,
		EventType:    "auth.logout",
		EntityType:   "user",
		EntityID:     currentUser.UserID,
		Summary:      "User logout synced.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create logout audit log")
	}

	return nil
}

func (s *Service) isSuperAdminIdentity(identity *utils.AppwriteIdentity) bool {
	if !s.cfg.SuperAdminEnabled || identity == nil {
		return false
	}

	email := strings.ToLower(strings.TrimSpace(identity.Email))
	if email == "" {
		return false
	}

	for _, allowedEmail := range s.cfg.SuperAdminEmails {
		if email == allowedEmail {
			return true
		}
	}

	return false
}

func (s *Service) platformAdminProfile(identity *utils.AppwriteIdentity) *PlatformAdminProfileResponse {
	return &PlatformAdminProfileResponse{
		AccountType:      "platform_admin",
		AppwriteUserID:   identity.ID,
		FullName:         identity.Name,
		Email:            strings.ToLower(strings.TrimSpace(identity.Email)),
		EmailVerified:    identity.EmailVerified,
		Permissions:      []string{"super_admin.access"},
		SuperAdminStatus: "active",
	}
}

func (s *Service) ensureEmailVerification(identity *utils.AppwriteIdentity) error {
	if s.cfg.RequireEmailVerification && !identity.EmailVerified {
		return apperrors.Forbidden("email verification is required")
	}

	return nil
}

func (s *Service) buildProfileByUserID(userID, businessID string) (*AuthProfileResponse, error) {
	user, err := s.userRepo.FindByIDAndBusinessID(userID, businessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to load user")
	}

	permissionKeys, err := s.roleRepo.GetPermissionKeysByRoleID(user.RoleID)
	if err != nil {
		return nil, apperrors.Internal("failed to load permissions")
	}
	branchScope, err := s.userBranchScope(user)
	if err != nil {
		return nil, err
	}
	currentBranchName, err := s.branchName(user.BusinessID, branchScope.CurrentBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load current branch")
	}
	assignedBranchName, err := s.branchName(user.BusinessID, branchScope.AssignedBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load assigned branch")
	}

	subscription, err := s.subscriptionRepo.FindByBusinessID(user.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load subscription")
	}

	return &AuthProfileResponse{
		AccountType:          "tenant_user",
		UserID:               user.ID,
		AppwriteUserID:       user.AppwriteUserID,
		BusinessID:           user.BusinessID,
		CurrentBranchID:      branchScope.CurrentBranchID,
		CurrentBranchName:    currentBranchName,
		AssignedBranchID:     branchScope.AssignedBranchID,
		AssignedBranchName:   assignedBranchName,
		AllowedBranchIDs:     branchScope.AllowedBranchIDs,
		CanAccessAllBranches: branchScope.CanAccessAllBranches,
		RoleID:               user.RoleID,
		RoleName:             user.Role.RoleName,
		Permissions:          visiblePermissionKeys(permissionKeys),
		SubscriptionStatus:   subscription.Status,
		FullName:             user.FullName,
		Email:                user.Email,
		Phone:                user.Phone,
		Status:               user.Status,
		EmailVerified:        user.EmailVerified,
		LastLoginAt:          user.LastLoginAt,
	}, nil
}

func (s *Service) branchName(businessID string, branchID *string) (*string, error) {
	if branchID == nil || strings.TrimSpace(*branchID) == "" {
		return nil, nil
	}
	var name string
	err := s.db.Table("branches").
		Select("branch_name").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", *branchID, businessID).
		Scan(&name).Error
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(name) == "" {
		return nil, nil
	}
	return &name, nil
}

func visiblePermissionKeys(keys []string) []string {
	visible := make([]string, 0, len(keys))
	for _, key := range keys {
		if permissions.IsDeprecatedBroadPermission(key) {
			continue
		}
		visible = append(visible, key)
	}
	return visible
}

func (s *Service) userBranchScope(user *users.User) (*userBranchScope, error) {
	ownerUserID, err := s.repo.BusinessOwnerUserID(user.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load branch access")
	}
	roleName := strings.ToLower(strings.TrimSpace(user.Role.RoleName))
	isOwner := ownerUserID != nil && *ownerUserID == user.ID
	canAccessAll := user.CanAccessAllBranches || isOwner || roleName == "admin"

	allowedBranchIDs, err := s.repo.AllowedBranchIDs(user.BusinessID, user.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load allowed branches")
	}
	if user.BranchID != nil && strings.TrimSpace(*user.BranchID) != "" {
		allowedBranchIDs = appendUniqueString(allowedBranchIDs, *user.BranchID)
	}
	if canAccessAll {
		activeBranchIDs, err := s.repo.ActiveBranchIDs(user.BusinessID)
		if err != nil {
			return nil, apperrors.Internal("failed to load branches")
		}
		allowedBranchIDs = activeBranchIDs
	}

	currentBranchID := user.CurrentBranchID
	if currentBranchID == nil && user.BranchID != nil {
		currentBranchID = user.BranchID
	}

	return &userBranchScope{
		CurrentBranchID:      currentBranchID,
		AssignedBranchID:     user.BranchID,
		AllowedBranchIDs:     uniqueStrings(allowedBranchIDs),
		CanAccessAllBranches: canAccessAll,
	}, nil
}

func appendUniqueString(values []string, value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return values
	}
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func uniqueStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = appendUniqueString(result, value)
	}
	return result
}
