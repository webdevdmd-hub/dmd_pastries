package superadmin

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) ListBusinesses(search, status string) ([]BusinessSummaryResponse, error) {
	var businesses []BusinessSummaryResponse
	query := s.db.Table("businesses b").
		Select(`
			b.id,
			b.business_name,
			b.owner_user_id,
			owner.full_name AS owner_name,
			owner.email AS owner_email,
			b.currency,
			b.timezone,
			COALESCE(b.vat_number, '') AS vat_number,
			b.status,
			sub.status AS subscription_status,
			sub.plan_type,
			COUNT(DISTINCT users.id) AS users_count,
			COUNT(DISTINCT branches.id) AS branches_count,
			COUNT(DISTINCT roles.id) AS roles_count,
			b.created_at,
			b.deleted_at
		`).
		Joins("LEFT JOIN users owner ON owner.id = b.owner_user_id").
		Joins("LEFT JOIN subscriptions sub ON sub.business_id = b.id").
		Joins("LEFT JOIN users ON users.business_id = b.id AND users.deleted_at IS NULL").
		Joins("LEFT JOIN branches ON branches.business_id = b.id AND branches.deleted_at IS NULL").
		Joins("LEFT JOIN roles ON roles.business_id = b.id AND roles.deleted_at IS NULL").
		Group("b.id, owner.full_name, owner.email, sub.status, sub.plan_type").
		Order("b.created_at DESC")

	if normalized := strings.TrimSpace(search); normalized != "" {
		pattern := "%" + strings.ToLower(normalized) + "%"
		query = query.Where(
			"LOWER(b.business_name) LIKE ? OR LOWER(owner.email) LIKE ? OR LOWER(COALESCE(owner.full_name, '')) LIKE ?",
			pattern,
			pattern,
			pattern,
		)
	}
	if normalized := strings.TrimSpace(status); normalized != "" && normalized != "all" {
		query = query.Where("b.status = ?", normalized)
	}

	if err := query.Scan(&businesses).Error; err != nil {
		return nil, apperrors.Internal("failed to load platform businesses")
	}

	return businesses, nil
}

func (s *Service) GetBusiness(businessID string) (*BusinessDetailResponse, error) {
	businesses, err := s.ListBusinesses("", "")
	if err != nil {
		return nil, err
	}

	var business *BusinessSummaryResponse
	for index := range businesses {
		if businesses[index].ID == businessID {
			business = &businesses[index]
			break
		}
	}
	if business == nil {
		return nil, apperrors.NotFound("business not found")
	}

	users, err := s.listUsers(UserFilters{BusinessID: businessID})
	if err != nil {
		return nil, err
	}
	branches, err := s.listBranches(businessID)
	if err != nil {
		return nil, err
	}
	roles, err := s.listRoles(businessID)
	if err != nil {
		return nil, err
	}
	subscription, err := s.subscription(businessID)
	if err != nil {
		return nil, err
	}
	warnings, err := s.businessDiagnostics(businessID)
	if err != nil {
		return nil, err
	}

	return &BusinessDetailResponse{
		Business:     *business,
		Users:        users,
		Branches:     branches,
		Roles:        roles,
		Subscription: subscription,
		Warnings:     warnings,
	}, nil
}

func (s *Service) getBusinessWithDB(db *gorm.DB, businessID string) (*BusinessDetailResponse, error) {
	business, err := s.getBusinessSummaryWithDB(db, businessID)
	if err != nil {
		return nil, err
	}
	users, err := s.listUsers(UserFilters{BusinessID: businessID})
	if err != nil {
		return nil, err
	}
	branches, err := s.listBranches(businessID)
	if err != nil {
		return nil, err
	}
	roles, err := s.listRoles(businessID)
	if err != nil {
		return nil, err
	}
	subscription, err := s.subscription(businessID)
	if err != nil {
		return nil, err
	}
	warnings, err := s.businessDiagnostics(businessID)
	if err != nil {
		return nil, err
	}

	return &BusinessDetailResponse{
		Business:     *business,
		Users:        users,
		Branches:     branches,
		Roles:        roles,
		Subscription: subscription,
		Warnings:     warnings,
	}, nil
}

func (s *Service) getBusinessSummaryWithDB(db *gorm.DB, businessID string) (*BusinessSummaryResponse, error) {
	var businesses []BusinessSummaryResponse
	err := db.Table("businesses b").
		Select(`
			b.id,
			b.business_name,
			b.owner_user_id,
			owner.full_name AS owner_name,
			owner.email AS owner_email,
			b.currency,
			b.timezone,
			COALESCE(b.vat_number, '') AS vat_number,
			b.status,
			sub.status AS subscription_status,
			sub.plan_type,
			COUNT(DISTINCT users.id) AS users_count,
			COUNT(DISTINCT branches.id) AS branches_count,
			COUNT(DISTINCT roles.id) AS roles_count,
			b.created_at,
			b.deleted_at
		`).
		Joins("LEFT JOIN users owner ON owner.id = b.owner_user_id").
		Joins("LEFT JOIN subscriptions sub ON sub.business_id = b.id").
		Joins("LEFT JOIN users ON users.business_id = b.id AND users.deleted_at IS NULL").
		Joins("LEFT JOIN branches ON branches.business_id = b.id AND branches.deleted_at IS NULL").
		Joins("LEFT JOIN roles ON roles.business_id = b.id AND roles.deleted_at IS NULL").
		Where("b.id = ?", businessID).
		Group("b.id, owner.full_name, owner.email, sub.status, sub.plan_type").
		Limit(1).
		Scan(&businesses).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load platform business")
	}
	if len(businesses) == 0 {
		return nil, apperrors.NotFound("business not found")
	}
	return &businesses[0], nil
}

func (s *Service) UpdateBusinessAction(currentUser *utils.AuthContext, businessID string, req UpdateBusinessActionRequest, ipAddress, userAgent string) (*BusinessActionResponse, error) {
	reason := strings.TrimSpace(req.Reason)
	if len(reason) < 10 {
		return nil, apperrors.BadRequest("reason must be at least 10 characters", nil)
	}

	before, err := s.GetBusiness(businessID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	actions := []string{}
	if req.BusinessName != nil {
		businessName := strings.TrimSpace(*req.BusinessName)
		if businessName == "" {
			return nil, apperrors.BadRequest("business_name cannot be empty", nil)
		}
		if businessName != before.Business.BusinessName {
			updates["business_name"] = businessName
			actions = append(actions, "profile")
		}
	}
	if req.Currency != nil {
		currency := strings.ToUpper(strings.TrimSpace(*req.Currency))
		if len(currency) < 3 || len(currency) > 10 {
			return nil, apperrors.BadRequest("currency must be 3 to 10 characters", nil)
		}
		if currency != before.Business.Currency {
			updates["currency"] = currency
			actions = append(actions, "currency")
		}
	}
	if req.Timezone != nil {
		timezone := strings.TrimSpace(*req.Timezone)
		if timezone == "" {
			return nil, apperrors.BadRequest("timezone cannot be empty", nil)
		}
		if timezone != before.Business.Timezone {
			updates["timezone"] = timezone
			actions = append(actions, "timezone")
		}
	}
	if req.VatNumber != nil {
		vatNumber := strings.TrimSpace(*req.VatNumber)
		if vatNumber != before.Business.VatNumber {
			updates["vat_number"] = vatNumber
			actions = append(actions, "vat")
		}
	}
	if req.Status != nil {
		status := strings.ToLower(strings.TrimSpace(*req.Status))
		if !allowedBusinessStatus(status) {
			return nil, apperrors.BadRequest("invalid business status", map[string]interface{}{"allowed_statuses": []string{"active", "inactive", "suspended"}})
		}
		if status != before.Business.Status {
			updates["status"] = status
			actions = append(actions, "status")
		}
	}
	if req.OwnerUserID != nil {
		ownerUserID := strings.TrimSpace(*req.OwnerUserID)
		if ownerUserID == "" {
			return nil, apperrors.BadRequest("owner_user_id cannot be empty", nil)
		}
		if before.Business.OwnerUserID == nil || *before.Business.OwnerUserID != ownerUserID {
			if err := s.validateBusinessOwnerCandidate(businessID, ownerUserID); err != nil {
				return nil, err
			}
			updates["owner_user_id"] = ownerUserID
			actions = append(actions, "owner")
		}
	}

	if len(updates) == 0 {
		return nil, apperrors.BadRequest("no business action changes provided", nil)
	}
	updates["updated_at"] = time.Now().UTC()

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start platform business action")
	}
	if err := tx.Table("businesses").
		Where("id = ?", businessID).
		Updates(updates).Error; err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update platform business")
	}

	after, err := s.getBusinessWithDB(tx, businessID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	action := "business." + strings.Join(actions, "_")
	if err := s.createPlatformAudit(tx, platformAuditInput{
		ActorAppwriteUserID: currentUser.AppwriteUserID,
		ActorEmail:          currentUser.Email,
		ActionType:          action,
		TargetType:          "business",
		TargetID:            businessID,
		TargetBusinessID:    businessID,
		Reason:              reason,
		BeforeData:          before,
		AfterData:           after,
		IPAddress:           ipAddress,
		UserAgent:           userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create platform audit log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit platform business action")
	}

	return &BusinessActionResponse{Business: *after, Action: action}, nil
}

type UserFilters struct {
	BusinessID string
	Search     string
	Status     string
}

func (s *Service) ListUsers(filters UserFilters) ([]UserSummaryResponse, error) {
	return s.listUsers(filters)
}

func (s *Service) GetUser(userID string) (*UserDetailResponse, error) {
	users, err := s.listUsers(UserFilters{})
	if err != nil {
		return nil, err
	}

	var user *UserSummaryResponse
	for index := range users {
		if users[index].ID == userID {
			user = &users[index]
			break
		}
	}
	if user == nil {
		return nil, apperrors.NotFound("user not found")
	}

	permissions, err := s.permissionKeys(user.RoleID)
	if err != nil {
		return nil, err
	}
	branchAccess, err := s.userBranchAccess(user.BusinessID, user.ID)
	if err != nil {
		return nil, err
	}
	auditLogs, err := s.userAuditLogs(user.BusinessID, user.ID)
	if err != nil {
		return nil, err
	}
	relatedCounts, err := s.userRelatedCounts(user.ID)
	if err != nil {
		return nil, err
	}
	warnings, err := s.userDiagnostics(*user)
	if err != nil {
		return nil, err
	}

	return &UserDetailResponse{
		User:              *user,
		Permissions:       permissions,
		BranchAccess:      branchAccess,
		AuditLogs:         auditLogs,
		RelatedDataCounts: relatedCounts,
		Warnings:          warnings,
	}, nil
}

func (s *Service) UpdateUserAction(currentUser *utils.AuthContext, userID string, req UpdateUserActionRequest, ipAddress, userAgent string) (*UserActionResponse, error) {
	reason := strings.TrimSpace(req.Reason)
	if len(reason) < 10 {
		return nil, apperrors.BadRequest("reason must be at least 10 characters", nil)
	}

	before, err := s.GetUser(userID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	actions := []string{}
	now := time.Now().UTC()

	if req.Operation != nil {
		operation := strings.ToLower(strings.TrimSpace(*req.Operation))
		if hasUserEditFields(req) {
			return nil, apperrors.BadRequest("delete and restore operations cannot be combined with other user edits", nil)
		}
		switch operation {
		case "soft_delete":
			if before.User.DeletedAt != nil {
				return nil, apperrors.BadRequest("user is already deleted", nil)
			}
			if err := requireTypedConfirmation(req.ConfirmationText, before.User.Email); err != nil {
				return nil, err
			}
			if err := s.validateOwnerAdminSafety(before.User, "soft_delete"); err != nil {
				return nil, err
			}
			updates["status"] = "deleted"
			updates["deleted_at"] = now
			actions = append(actions, "soft_deleted")
		case "restore":
			if before.User.DeletedAt == nil {
				return nil, apperrors.BadRequest("user is not deleted", nil)
			}
			if err := requireTypedConfirmation(req.ConfirmationText, before.User.Email); err != nil {
				return nil, err
			}
			updates["status"] = "active"
			updates["deleted_at"] = nil
			actions = append(actions, "restored")
		case "hard_delete":
			if err := requireTypedConfirmation(req.ConfirmationText, before.User.Email); err != nil {
				return nil, err
			}
			preview, err := s.hardDeletePreview(before)
			if err != nil {
				return nil, err
			}
			if !preview.CanHardDelete {
				return nil, apperrors.BadRequest("hard delete is blocked", map[string]interface{}{
					"decision":              preview.Decision,
					"requires_soft_delete":  preview.RequiresSoftDelete,
					"total_blocking_rows":   preview.TotalBlockingRows,
					"total_cleanup_rows":    preview.TotalCleanupRows,
					"required_confirm_text": preview.RequiredConfirmText,
				})
			}
			return s.hardDeleteUser(currentUser, before, preview, reason, ipAddress, userAgent)
		default:
			return nil, apperrors.BadRequest("invalid operation", map[string]interface{}{"allowed_operations": []string{"soft_delete", "restore", "hard_delete"}})
		}
	}

	if before.User.DeletedAt != nil && (req.Operation == nil || strings.TrimSpace(*req.Operation) != "restore") {
		return nil, apperrors.BadRequest("deleted users can only be restored before other edits", nil)
	}

	if req.FullName != nil {
		fullName := strings.TrimSpace(*req.FullName)
		if fullName == "" {
			return nil, apperrors.BadRequest("full_name cannot be empty", nil)
		}
		if fullName != before.User.FullName {
			updates["full_name"] = fullName
			actions = append(actions, "profile")
		}
	}

	if req.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*req.Email))
		if err := s.validateLocalEmail(before.User.BusinessID, before.User.ID, email); err != nil {
			return nil, err
		}
		if email != before.User.Email {
			updates["email"] = email
			actions = append(actions, "email")
		}
	}

	if req.Phone != nil {
		phone := strings.TrimSpace(*req.Phone)
		if phone != before.User.Phone {
			updates["phone"] = phone
			actions = append(actions, "profile")
		}
	}

	if req.Status != nil {
		status := strings.ToLower(strings.TrimSpace(*req.Status))
		if !allowedPlatformUserStatus(status) {
			return nil, apperrors.BadRequest("invalid status", map[string]interface{}{"allowed_statuses": []string{"active", "inactive", "suspended", "invited"}})
		}
		if status != before.User.Status {
			if err := s.validateStatusChange(before.User, status); err != nil {
				return nil, err
			}
			updates["status"] = status
			actions = append(actions, "status")
		}
	}

	if req.RoleID != nil {
		roleID := strings.TrimSpace(*req.RoleID)
		if roleID == "" {
			return nil, apperrors.BadRequest("role_id cannot be empty", nil)
		}
		if roleID != before.User.RoleID {
			if err := s.validateRole(before.User.BusinessID, roleID); err != nil {
				return nil, err
			}
			if err := s.validateOwnerAdminSafety(before.User, "role"); err != nil {
				return nil, err
			}
			updates["role_id"] = roleID
			actions = append(actions, "role")
		}
	}

	if req.BranchID != nil {
		branchID := strings.TrimSpace(*req.BranchID)
		if branchID == "" {
			return nil, apperrors.BadRequest("branch_id cannot be empty", nil)
		}
		if before.User.BranchID == nil || *before.User.BranchID != branchID {
			if err := s.validateBranch(before.User.BusinessID, branchID); err != nil {
				return nil, err
			}
			updates["branch_id"] = branchID
			updates["current_branch_id"] = branchID
			actions = append(actions, "primary_branch")
		}
	}

	if req.CanAccessAllBranches != nil && *req.CanAccessAllBranches != before.User.CanAccessAllBranches {
		updates["can_access_all_branches"] = *req.CanAccessAllBranches
		actions = append(actions, "all_branch_access")
	}

	replaceBranchAccess := req.BranchAccessIDs != nil
	if replaceBranchAccess {
		branchIDs := uniqueTrimmedStrings(req.BranchAccessIDs)
		effectiveAllBranchAccess := before.User.CanAccessAllBranches
		if req.CanAccessAllBranches != nil {
			effectiveAllBranchAccess = *req.CanAccessAllBranches
		}
		if len(branchIDs) == 0 && !effectiveAllBranchAccess {
			return nil, apperrors.BadRequest("at least one branch access record is required when all-branch access is disabled", nil)
		}
		for _, branchID := range branchIDs {
			if err := s.validateBranch(before.User.BusinessID, branchID); err != nil {
				return nil, err
			}
		}
		req.BranchAccessIDs = branchIDs
		actions = append(actions, "branch_access")
	}

	if len(updates) == 0 && !replaceBranchAccess {
		return nil, apperrors.BadRequest("no user action changes provided", nil)
	}
	updates["updated_at"] = now

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start platform action")
	}

	if len(updates) > 1 {
		if err := tx.Table("users").
			Where("id = ? AND business_id = ?", before.User.ID, before.User.BusinessID).
			Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update platform user")
		}
	}

	if req.BranchID != nil {
		branchID := strings.TrimSpace(*req.BranchID)
		if err := s.ensureBranchAccess(tx, before.User.BusinessID, before.User.ID, branchID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to grant primary branch access")
		}
	}

	if replaceBranchAccess {
		if err := tx.Table("user_branch_access").
			Where("business_id = ? AND user_id = ?", before.User.BusinessID, before.User.ID).
			Delete(nil).Error; err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to reset user branch access")
		}
		for _, branchID := range req.BranchAccessIDs {
			if err := s.ensureBranchAccess(tx, before.User.BusinessID, before.User.ID, branchID); err != nil {
				tx.Rollback()
				return nil, apperrors.Internal("failed to grant branch access")
			}
		}
	}

	after, err := s.getUserDetailWithDB(tx, before.User.ID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	action := "user." + strings.Join(actions, "_")
	if err := s.createPlatformAudit(tx, platformAuditInput{
		ActorAppwriteUserID: currentUser.AppwriteUserID,
		ActorEmail:          currentUser.Email,
		ActionType:          action,
		TargetType:          "user",
		TargetID:            before.User.ID,
		TargetBusinessID:    before.User.BusinessID,
		Reason:              reason,
		BeforeData:          before,
		AfterData:           after,
		IPAddress:           ipAddress,
		UserAgent:           userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create platform audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit platform user action")
	}

	return &UserActionResponse{User: *after, Action: action}, nil
}

func (s *Service) GetUserHardDeletePreview(userID string) (*HardDeletePreviewResponse, error) {
	user, err := s.GetUser(userID)
	if err != nil {
		return nil, err
	}
	return s.hardDeletePreview(user)
}

func (s *Service) Diagnostics() ([]DiagnosticResponse, error) {
	var diagnostics []DiagnosticResponse

	branchless, err := s.branchlessOperationalStaff("")
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, branchless...)

	missingRoles, err := s.usersWithMissingRoles("")
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, missingRoles...)

	noAdmin, err := s.businessesWithoutActiveAdmin("")
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, noAdmin...)

	duplicates, err := s.duplicateEmails()
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, duplicates...)

	return diagnostics, nil
}

func (s *Service) listUsers(filters UserFilters) ([]UserSummaryResponse, error) {
	var users []UserSummaryResponse
	query := s.db.Table("users u").
		Select(`
			u.id,
			u.appwrite_user_id,
			u.business_id,
			b.business_name,
			u.branch_id,
			br.branch_name,
			u.current_branch_id,
			u.role_id,
			COALESCE(r.role_name, 'Missing role') AS role_name,
			u.full_name,
			u.email,
			u.phone,
			u.status,
			u.email_verified,
			u.can_access_all_branches,
			u.last_login_at,
			u.created_at,
			u.deleted_at
		`).
		Joins("JOIN businesses b ON b.id = u.business_id").
		Joins("LEFT JOIN branches br ON br.id = u.branch_id").
		Joins("LEFT JOIN roles r ON r.id = u.role_id").
		Order("u.created_at DESC")

	if filters.BusinessID != "" {
		query = query.Where("u.business_id = ?", filters.BusinessID)
	}
	if normalized := strings.TrimSpace(filters.Search); normalized != "" {
		pattern := "%" + strings.ToLower(normalized) + "%"
		query = query.Where(
			"LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.appwrite_user_id) LIKE ? OR LOWER(b.business_name) LIKE ?",
			pattern,
			pattern,
			pattern,
			pattern,
		)
	}
	if normalized := strings.TrimSpace(filters.Status); normalized != "" && normalized != "all" {
		query = query.Where("u.status = ?", normalized)
	}

	if err := query.Scan(&users).Error; err != nil {
		return nil, apperrors.Internal("failed to load platform users")
	}

	return users, nil
}

func (s *Service) listBranches(businessID string) ([]BranchSummaryResponse, error) {
	var branches []BranchSummaryResponse
	err := s.db.Table("branches").
		Select("id, branch_name, code, status, is_default").
		Where("business_id = ? AND deleted_at IS NULL", businessID).
		Order("is_default DESC, branch_name ASC").
		Scan(&branches).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load business branches")
	}
	return branches, nil
}

func (s *Service) listRoles(businessID string) ([]RoleSummaryResponse, error) {
	var roles []RoleSummaryResponse
	err := s.db.Table("roles r").
		Select(`
			r.id,
			r.role_name,
			r.description,
			r.is_system_default,
			COUNT(users.id) AS users_count,
			r.deleted_at
		`).
		Joins("LEFT JOIN users ON users.role_id = r.id AND users.deleted_at IS NULL").
		Where("r.business_id = ?", businessID).
		Group("r.id").
		Order("r.role_name ASC").
		Scan(&roles).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load business roles")
	}
	return roles, nil
}

func (s *Service) subscription(businessID string) (*SubscriptionResponse, error) {
	var subscription SubscriptionResponse
	err := s.db.Table("subscriptions").
		Select("id, plan_type, status, user_limit, branch_limit, trial_ends_at, renewal_date").
		Where("business_id = ?", businessID).
		Order("created_at DESC").
		Limit(1).
		Scan(&subscription).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load business subscription")
	}
	if subscription.ID == "" {
		return nil, nil
	}
	return &subscription, nil
}

func (s *Service) permissionKeys(roleID string) ([]string, error) {
	var keys []string
	err := s.db.Table("role_permissions rp").
		Select("p.permission_key").
		Joins("JOIN permissions p ON p.id = rp.permission_id").
		Where("rp.role_id = ? AND rp.allowed = true", roleID).
		Order("p.permission_key ASC").
		Scan(&keys).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load user permissions")
	}
	return keys, nil
}

func (s *Service) userBranchAccess(businessID, userID string) ([]BranchSummaryResponse, error) {
	return s.userBranchAccessWithDB(s.db, businessID, userID)
}

func (s *Service) userBranchAccessWithDB(db *gorm.DB, businessID, userID string) ([]BranchSummaryResponse, error) {
	var branches []BranchSummaryResponse
	err := db.Table("user_branch_access uba").
		Select("b.id, b.branch_name, b.code, b.status, b.is_default").
		Joins("JOIN branches b ON b.id = uba.branch_id").
		Where("uba.business_id = ? AND uba.user_id = ? AND b.deleted_at IS NULL", businessID, userID).
		Order("b.is_default DESC, b.branch_name ASC").
		Scan(&branches).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load user branch access")
	}
	return branches, nil
}

func (s *Service) userAuditLogs(businessID, userID string) ([]AuditLogSummaryResponse, error) {
	var logs []AuditLogSummaryResponse
	err := s.db.Table("audit_logs").
		Select("id, event_type, entity_type, entity_id, summary, actor_user_id, created_at").
		Where("business_id = ? AND (actor_user_id = ? OR target_user_id = ? OR entity_id = ?)", businessID, userID, userID, userID).
		Order("created_at DESC").
		Limit(25).
		Scan(&logs).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load user audit logs")
	}
	return logs, nil
}

type relatedCountQuery struct {
	module string
	table  string
	where  string
}

type hardDeleteCountQuery struct {
	module      string
	table       string
	where       string
	cleanupPath string
}

func (s *Service) userRelatedCounts(userID string) ([]RelatedDataCount, error) {
	queries := []relatedCountQuery{
		{module: "Sales", table: "sales", where: "cashier_user_id = ?"},
		{module: "Sales", table: "held_sales", where: "cashier_user_id = ?"},
		{module: "Payments", table: "sale_payments", where: "paid_by_user_id = ?"},
		{module: "Payments", table: "payment_refunds", where: "created_by_user_id = ? OR approved_by_user_id = ?"},
		{module: "Customers", table: "customers", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Customers", table: "customer_notes", where: "created_by_user_id = ?"},
		{module: "Inventory", table: "stock_movements", where: "created_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_orders", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_invoices", where: "created_by_user_id = ? OR updated_by_user_id = ? OR cancelled_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_receipts", where: "received_by_user_id = ?"},
		{module: "Manufacturing", table: "production_batches", where: "created_by_user_id = ? OR updated_by_user_id = ? OR completed_by_user_id = ?"},
		{module: "Accounting", table: "journal_entries", where: "created_by_user_id = ? OR updated_by_user_id = ? OR posted_by_user_id = ? OR reversed_by_user_id = ?"},
		{module: "Audit", table: "audit_logs", where: "actor_user_id = ? OR target_user_id = ? OR entity_id = ?"},
	}

	counts := make([]RelatedDataCount, 0, len(queries))
	for _, query := range queries {
		var count int64
		args := make([]interface{}, strings.Count(query.where, "?"))
		for index := range args {
			args[index] = userID
		}
		if err := s.db.Table(query.table).Where(query.where, args...).Count(&count).Error; err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to count %s records", query.table))
		}
		counts = append(counts, RelatedDataCount{
			Module: query.module,
			Table:  query.table,
			Count:  count,
		})
	}

	return counts, nil
}

func (s *Service) hardDeletePreview(user *UserDetailResponse) (*HardDeletePreviewResponse, error) {
	blockingCounts, err := s.countHardDeleteQueries(user.User.ID, hardDeleteBlockingQueries())
	if err != nil {
		return nil, err
	}
	cleanupCounts, err := s.countHardDeleteQueries(user.User.ID, hardDeleteCleanupQueries())
	if err != nil {
		return nil, err
	}

	totalBlocking := totalRelatedCount(blockingCounts)
	totalCleanup := totalRelatedCount(cleanupCounts)
	requiresSoftDelete := user.User.DeletedAt == nil
	canHardDelete := !requiresSoftDelete && totalBlocking == 0
	decision := "allowed"
	if requiresSoftDelete {
		decision = "blocked_requires_soft_delete"
	} else if totalBlocking > 0 {
		decision = "blocked_related_records"
	}

	return &HardDeletePreviewResponse{
		UserID:              user.User.ID,
		Email:               user.User.Email,
		IsSoftDeleted:       user.User.DeletedAt != nil,
		CanHardDelete:       canHardDelete,
		RequiresSoftDelete:  requiresSoftDelete,
		BlockingCounts:      blockingCounts,
		CleanupCounts:       cleanupCounts,
		TotalBlockingRows:   totalBlocking,
		TotalCleanupRows:    totalCleanup,
		Decision:            decision,
		RequiredConfirmText: user.User.Email,
	}, nil
}

func (s *Service) countHardDeleteQueries(userID string, queries []hardDeleteCountQuery) ([]RelatedDataCount, error) {
	counts := make([]RelatedDataCount, 0, len(queries))
	for _, query := range queries {
		var count int64
		args := make([]interface{}, strings.Count(query.where, "?"))
		for index := range args {
			args[index] = userID
		}
		if err := s.db.Table(query.table).Where(query.where, args...).Count(&count).Error; err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to count %s records", query.table))
		}
		if count == 0 {
			continue
		}
		counts = append(counts, RelatedDataCount{
			Module: query.module,
			Table:  query.table,
			Count:  count,
		})
	}
	return counts, nil
}

func (s *Service) hardDeleteUser(
	currentUser *utils.AuthContext,
	before *UserDetailResponse,
	preview *HardDeletePreviewResponse,
	reason string,
	ipAddress string,
	userAgent string,
) (*UserActionResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start hard delete transaction")
	}

	if err := tx.Table("user_branch_access").
		Where("business_id = ? AND user_id = ?", before.User.BusinessID, before.User.ID).
		Delete(nil).Error; err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to cleanup branch access before hard delete")
	}

	if err := s.createPlatformAudit(tx, platformAuditInput{
		ActorAppwriteUserID: currentUser.AppwriteUserID,
		ActorEmail:          currentUser.Email,
		ActionType:          "user.hard_deleted",
		TargetType:          "user",
		TargetID:            before.User.ID,
		TargetBusinessID:    before.User.BusinessID,
		Reason:              reason,
		BeforeData:          before,
		AfterData:           preview,
		IPAddress:           ipAddress,
		UserAgent:           userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create platform audit log")
	}

	result := tx.Exec("DELETE FROM users WHERE id = ? AND business_id = ? AND deleted_at IS NOT NULL", before.User.ID, before.User.BusinessID)
	if result.Error != nil {
		tx.Rollback()
		return nil, apperrors.Internal("hard delete failed; database still has protected references")
	}
	if result.RowsAffected == 0 {
		tx.Rollback()
		return nil, apperrors.BadRequest("hard delete requires a soft-deleted user", nil)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit hard delete")
	}

	return &UserActionResponse{User: *before, Action: "user.hard_deleted"}, nil
}

func hardDeleteCleanupQueries() []hardDeleteCountQuery {
	return []hardDeleteCountQuery{
		{module: "Access", table: "user_branch_access", where: "user_id = ?", cleanupPath: "cascade_delete"},
	}
}

func hardDeleteBlockingQueries() []hardDeleteCountQuery {
	return []hardDeleteCountQuery{
		{module: "Business", table: "businesses", where: "owner_user_id = ?"},
		{module: "Branches", table: "branches", where: "manager_user_id = ?"},
		{module: "Sales", table: "sales", where: "cashier_user_id = ?"},
		{module: "Sales", table: "held_sales", where: "cashier_user_id = ?"},
		{module: "Sales", table: "sale_refunds", where: "created_by_user_id = ? OR approved_by_user_id = ?"},
		{module: "Sales returns", table: "sales_returns", where: "created_by_user_id = ? OR approved_by_user_id = ? OR posted_by_user_id = ? OR cancelled_by_user_id = ?"},
		{module: "Payments", table: "sale_payments", where: "paid_by_user_id = ?"},
		{module: "Payments", table: "payment_refunds", where: "created_by_user_id = ? OR approved_by_user_id = ?"},
		{module: "Payments", table: "purchase_invoice_payments", where: "paid_by_user_id = ?"},
		{module: "Payments", table: "supplier_payments", where: "paid_by_user_id = ?"},
		{module: "Customers", table: "customers", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Customers", table: "customer_notes", where: "created_by_user_id = ?"},
		{module: "Products", table: "products", where: "created_by = ? OR updated_by = ?"},
		{module: "Suppliers", table: "suppliers", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Suppliers", table: "supplier_notes", where: "created_by_user_id = ?"},
		{module: "Inventory", table: "stock_movements", where: "created_by_user_id = ?"},
		{module: "Inventory", table: "inventory_adjustments", where: "created_by_user_id = ?"},
		{module: "Inventory", table: "stock_locations", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Inventory", table: "stock_transfers", where: "created_by_user_id = ? OR completed_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_orders", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_invoices", where: "created_by_user_id = ? OR updated_by_user_id = ? OR cancelled_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_receipts", where: "received_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_returns", where: "created_by_user_id = ? OR posted_by_user_id = ? OR cancelled_by_user_id = ? OR reversed_by_user_id = ?"},
		{module: "Purchasing", table: "purchase_order_revisions", where: "created_by_user_id = ?"},
		{module: "Manufacturing", table: "production_batches", where: "created_by_user_id = ? OR updated_by_user_id = ? OR completed_by_user_id = ?"},
		{module: "Bakery orders", table: "bakery_orders", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Bakery orders", table: "bakery_order_payments", where: "paid_by_user_id = ?"},
		{module: "Recipes", table: "recipes", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Recipes", table: "recipe_versions", where: "created_by_user_id = ?"},
		{module: "Ingredients", table: "ingredients", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Packaging", table: "packaging_items", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Accounting", table: "chart_of_accounts", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Accounting", table: "journal_entries", where: "created_by_user_id = ? OR updated_by_user_id = ? OR posted_by_user_id = ? OR reversed_by_user_id = ?"},
		{module: "Accounting", table: "expenses", where: "created_by_user_id = ? OR updated_by_user_id = ? OR voided_by_user_id = ?"},
		{module: "Accounting", table: "account_transfers", where: "created_by_user_id = ?"},
		{module: "Accounting", table: "platform_settlements", where: "created_by_user_id = ?"},
		{module: "Accounting", table: "payment_accounts", where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{module: "Audit", table: "audit_logs", where: "user_id = ? OR actor_user_id = ? OR target_user_id = ? OR entity_id = ?"},
	}
}

func totalRelatedCount(counts []RelatedDataCount) int64 {
	var total int64
	for _, count := range counts {
		total += count.Count
	}
	return total
}

func (s *Service) businessDiagnostics(businessID string) ([]DiagnosticResponse, error) {
	var diagnostics []DiagnosticResponse

	branchless, err := s.branchlessOperationalStaff(businessID)
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, branchless...)

	missingRoles, err := s.usersWithMissingRoles(businessID)
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, missingRoles...)

	noAdmin, err := s.businessesWithoutActiveAdmin(businessID)
	if err != nil {
		return nil, err
	}
	diagnostics = append(diagnostics, noAdmin...)

	return diagnostics, nil
}

func (s *Service) userDiagnostics(user UserSummaryResponse) ([]DiagnosticResponse, error) {
	var diagnostics []DiagnosticResponse
	if user.BranchID == nil && !user.CanAccessAllBranches && !isOwnerAdminRole(user.RoleName) {
		diagnostics = append(diagnostics, DiagnosticResponse{
			ID:         "user-branchless-" + user.ID,
			Severity:   "warning",
			Category:   "branch_access",
			Summary:    "Operational user has no assigned branch.",
			BusinessID: &user.BusinessID,
			UserID:     &user.ID,
		})
	}
	if user.RoleName == "Missing role" {
		diagnostics = append(diagnostics, DiagnosticResponse{
			ID:         "user-missing-role-" + user.ID,
			Severity:   "critical",
			Category:   "role_access",
			Summary:    "User points to a missing or inaccessible role.",
			BusinessID: &user.BusinessID,
			UserID:     &user.ID,
		})
	}
	return diagnostics, nil
}

func (s *Service) branchlessOperationalStaff(businessID string) ([]DiagnosticResponse, error) {
	type row struct {
		UserID       string
		BusinessID   string
		FullName     string
		Email        string
		RoleName     string
		BusinessName string
	}
	var rows []row
	query := s.db.Table("users u").
		Select("u.id AS user_id, u.business_id, u.full_name, u.email, r.role_name, b.business_name").
		Joins("JOIN businesses b ON b.id = u.business_id").
		Joins("LEFT JOIN roles r ON r.id = u.role_id").
		Where("u.deleted_at IS NULL AND u.status = 'active' AND u.branch_id IS NULL AND u.can_access_all_branches = false")
	if businessID != "" {
		query = query.Where("u.business_id = ?", businessID)
	}
	if err := query.Scan(&rows).Error; err != nil {
		return nil, apperrors.Internal("failed to load branch diagnostics")
	}

	diagnostics := make([]DiagnosticResponse, 0, len(rows))
	for _, item := range rows {
		if isOwnerAdminRole(item.RoleName) {
			continue
		}
		businessID := item.BusinessID
		userID := item.UserID
		diagnostics = append(diagnostics, DiagnosticResponse{
			ID:         "branchless-" + item.UserID,
			Severity:   "warning",
			Category:   "branch_access",
			Summary:    fmt.Sprintf("%s (%s) in %s has no assigned branch.", item.FullName, item.Email, item.BusinessName),
			BusinessID: &businessID,
			UserID:     &userID,
		})
	}
	return diagnostics, nil
}

func (s *Service) usersWithMissingRoles(businessID string) ([]DiagnosticResponse, error) {
	type row struct {
		UserID       string
		BusinessID   string
		FullName     string
		BusinessName string
	}
	var rows []row
	query := s.db.Table("users u").
		Select("u.id AS user_id, u.business_id, u.full_name, b.business_name").
		Joins("JOIN businesses b ON b.id = u.business_id").
		Joins("LEFT JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL").
		Where("u.deleted_at IS NULL AND r.id IS NULL")
	if businessID != "" {
		query = query.Where("u.business_id = ?", businessID)
	}
	if err := query.Scan(&rows).Error; err != nil {
		return nil, apperrors.Internal("failed to load role diagnostics")
	}

	diagnostics := make([]DiagnosticResponse, 0, len(rows))
	for _, item := range rows {
		businessID := item.BusinessID
		userID := item.UserID
		diagnostics = append(diagnostics, DiagnosticResponse{
			ID:         "missing-role-" + item.UserID,
			Severity:   "critical",
			Category:   "role_access",
			Summary:    fmt.Sprintf("%s in %s points to a missing or deleted role.", item.FullName, item.BusinessName),
			BusinessID: &businessID,
			UserID:     &userID,
		})
	}
	return diagnostics, nil
}

func (s *Service) businessesWithoutActiveAdmin(businessID string) ([]DiagnosticResponse, error) {
	type row struct {
		BusinessID   string
		BusinessName string
	}
	var rows []row
	query := s.db.Table("businesses b").
		Select("b.id AS business_id, b.business_name").
		Where("b.deleted_at IS NULL").
		Where(`NOT EXISTS (
			SELECT 1
			FROM users u
			JOIN roles r ON r.id = u.role_id
			WHERE u.business_id = b.id
				AND u.deleted_at IS NULL
				AND u.status = 'active'
				AND (LOWER(r.role_name) = 'admin' OR u.id = b.owner_user_id)
		)`)
	if businessID != "" {
		query = query.Where("b.id = ?", businessID)
	}
	if err := query.Scan(&rows).Error; err != nil {
		return nil, apperrors.Internal("failed to load admin diagnostics")
	}

	diagnostics := make([]DiagnosticResponse, 0, len(rows))
	for _, item := range rows {
		businessID := item.BusinessID
		diagnostics = append(diagnostics, DiagnosticResponse{
			ID:         "no-active-admin-" + item.BusinessID,
			Severity:   "critical",
			Category:   "business_access",
			Summary:    fmt.Sprintf("%s has no active owner/admin user.", item.BusinessName),
			BusinessID: &businessID,
		})
	}
	return diagnostics, nil
}

func (s *Service) duplicateEmails() ([]DiagnosticResponse, error) {
	type row struct {
		Email         string
		BusinessCount int64
		UserCount     int64
	}
	var rows []row
	if err := s.db.Table("users").
		Select("LOWER(email) AS email, COUNT(DISTINCT business_id) AS business_count, COUNT(*) AS user_count").
		Where("deleted_at IS NULL").
		Group("LOWER(email)").
		Having("COUNT(DISTINCT business_id) > 1").
		Scan(&rows).Error; err != nil {
		return nil, apperrors.Internal("failed to load duplicate email diagnostics")
	}

	diagnostics := make([]DiagnosticResponse, 0, len(rows))
	for _, item := range rows {
		diagnostics = append(diagnostics, DiagnosticResponse{
			ID:       "duplicate-email-" + item.Email,
			Severity: "info",
			Category: "identity",
			Summary:  fmt.Sprintf("%s appears on %d users across %d businesses.", item.Email, item.UserCount, item.BusinessCount),
		})
	}
	return diagnostics, nil
}

func isOwnerAdminRole(roleName string) bool {
	normalized := strings.ToLower(strings.TrimSpace(roleName))
	return strings.Contains(normalized, "admin") || strings.Contains(normalized, "owner")
}

func (s *Service) getUserDetailWithDB(db *gorm.DB, userID string) (*UserDetailResponse, error) {
	var users []UserSummaryResponse
	query := db.Table("users u").
		Select(`
			u.id,
			u.appwrite_user_id,
			u.business_id,
			b.business_name,
			u.branch_id,
			br.branch_name,
			u.current_branch_id,
			u.role_id,
			COALESCE(r.role_name, 'Missing role') AS role_name,
			u.full_name,
			u.email,
			u.phone,
			u.status,
			u.email_verified,
			u.can_access_all_branches,
			u.last_login_at,
			u.created_at,
			u.deleted_at
		`).
		Joins("JOIN businesses b ON b.id = u.business_id").
		Joins("LEFT JOIN branches br ON br.id = u.branch_id").
		Joins("LEFT JOIN roles r ON r.id = u.role_id").
		Where("u.id = ?", userID).
		Limit(1)
	if err := query.Scan(&users).Error; err != nil {
		return nil, apperrors.Internal("failed to load platform user")
	}
	if len(users) == 0 {
		return nil, apperrors.NotFound("user not found")
	}

	user := users[0]
	permissions, err := s.permissionKeys(user.RoleID)
	if err != nil {
		return nil, err
	}
	branchAccess, err := s.userBranchAccessWithDB(db, user.BusinessID, user.ID)
	if err != nil {
		return nil, err
	}
	auditLogs, err := s.userAuditLogs(user.BusinessID, user.ID)
	if err != nil {
		return nil, err
	}
	relatedCounts, err := s.userRelatedCounts(user.ID)
	if err != nil {
		return nil, err
	}
	warnings, err := s.userDiagnostics(user)
	if err != nil {
		return nil, err
	}

	return &UserDetailResponse{
		User:              user,
		Permissions:       permissions,
		BranchAccess:      branchAccess,
		AuditLogs:         auditLogs,
		RelatedDataCounts: relatedCounts,
		Warnings:          warnings,
	}, nil
}

func allowedPlatformUserStatus(status string) bool {
	switch status {
	case "active", "inactive", "suspended", "invited":
		return true
	default:
		return false
	}
}

func allowedBusinessStatus(status string) bool {
	switch status {
	case "active", "inactive", "suspended":
		return true
	default:
		return false
	}
}

func (s *Service) validateBusinessOwnerCandidate(businessID, userID string) error {
	var users []UserSummaryResponse
	if err := s.db.Table("users u").
		Select(`
			u.id,
			u.appwrite_user_id,
			u.business_id,
			b.business_name,
			u.branch_id,
			br.branch_name,
			u.current_branch_id,
			u.role_id,
			COALESCE(r.role_name, 'Missing role') AS role_name,
			u.full_name,
			u.email,
			u.phone,
			u.status,
			u.email_verified,
			u.can_access_all_branches,
			u.last_login_at,
			u.created_at,
			u.deleted_at
		`).
		Joins("JOIN businesses b ON b.id = u.business_id").
		Joins("LEFT JOIN branches br ON br.id = u.branch_id").
		Joins("LEFT JOIN roles r ON r.id = u.role_id").
		Where("u.id = ? AND u.business_id = ? AND u.deleted_at IS NULL", userID, businessID).
		Limit(1).
		Scan(&users).Error; err != nil {
		return apperrors.Internal("failed to validate owner user")
	}
	if len(users) == 0 {
		return apperrors.BadRequest("owner_user_id must be an existing active business user", nil)
	}
	user := users[0]
	if user.Status != "active" {
		return apperrors.BadRequest("owner_user_id must be an active user", nil)
	}
	if !isOwnerAdminRole(user.RoleName) {
		return apperrors.BadRequest("owner_user_id must belong to an owner/admin role", nil)
	}
	return nil
}

func (s *Service) validateStatusChange(user UserSummaryResponse, status string) error {
	if status == "active" {
		return nil
	}
	return s.validateOwnerAdminSafety(user, "status")
}

func (s *Service) validateOwnerAdminSafety(user UserSummaryResponse, field string) error {
	if isOwnerAdminRole(user.RoleName) {
		var count int64
		err := s.db.Table("users u").
			Joins("JOIN roles r ON r.id = u.role_id").
			Where("u.business_id = ? AND u.id <> ? AND u.deleted_at IS NULL AND u.status = 'active'", user.BusinessID, user.ID).
			Where("LOWER(r.role_name) = 'admin' OR LOWER(r.role_name) LIKE '%owner%'").
			Count(&count).Error
		if err != nil {
			return apperrors.Internal("failed to validate active admin coverage")
		}
		if count == 0 {
			return apperrors.BadRequest("cannot change the only active owner/admin user", map[string]interface{}{"field": field})
		}
	}
	return nil
}

func (s *Service) validateRole(businessID, roleID string) error {
	var count int64
	if err := s.db.Table("roles").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", roleID, businessID).
		Count(&count).Error; err != nil {
		return apperrors.Internal("failed to validate role")
	}
	if count == 0 {
		return apperrors.BadRequest("invalid role_id", nil)
	}
	return nil
}

func (s *Service) validateBranch(businessID, branchID string) error {
	var count int64
	if err := s.db.Table("branches").
		Where("id = ? AND business_id = ? AND status = 'active' AND deleted_at IS NULL", branchID, businessID).
		Count(&count).Error; err != nil {
		return apperrors.Internal("failed to validate branch")
	}
	if count == 0 {
		return apperrors.BadRequest("invalid branch_id", nil)
	}
	return nil
}

func (s *Service) validateLocalEmail(businessID, userID, email string) error {
	if email == "" || !strings.Contains(email, "@") {
		return apperrors.BadRequest("valid email is required", nil)
	}
	var count int64
	if err := s.db.Table("users").
		Where("business_id = ? AND id <> ? AND LOWER(email) = LOWER(?)", businessID, userID, email).
		Count(&count).Error; err != nil {
		return apperrors.Internal("failed to validate user email")
	}
	if count > 0 {
		return apperrors.Conflict("user email already exists in this business", nil)
	}
	return nil
}

func requireTypedConfirmation(value *string, expected string) error {
	if value == nil || strings.TrimSpace(*value) != expected {
		return apperrors.BadRequest("typed confirmation must match the user email", map[string]interface{}{"expected": expected})
	}
	return nil
}

func hasUserEditFields(req UpdateUserActionRequest) bool {
	return req.FullName != nil ||
		req.Email != nil ||
		req.Phone != nil ||
		req.Status != nil ||
		req.RoleID != nil ||
		req.BranchID != nil ||
		req.CanAccessAllBranches != nil ||
		req.BranchAccessIDs != nil
}

func (s *Service) ensureBranchAccess(tx *gorm.DB, businessID, userID, branchID string) error {
	return tx.Exec(`
		INSERT INTO user_branch_access (id, business_id, user_id, branch_id, created_at)
		VALUES (?, ?, ?, ?, now())
		ON CONFLICT (business_id, user_id, branch_id) DO NOTHING
	`, utils.NewUUID(), businessID, userID, branchID).Error
}

func uniqueTrimmedStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		result = append(result, trimmed)
	}
	return result
}

type platformAuditInput struct {
	ActorAppwriteUserID string
	ActorEmail          string
	ActionType          string
	TargetType          string
	TargetID            string
	TargetBusinessID    string
	Reason              string
	BeforeData          interface{}
	AfterData           interface{}
	IPAddress           string
	UserAgent           string
}

func (s *Service) createPlatformAudit(tx *gorm.DB, input platformAuditInput) error {
	beforeData, err := json.Marshal(input.BeforeData)
	if err != nil {
		return err
	}
	afterData, err := json.Marshal(input.AfterData)
	if err != nil {
		return err
	}

	return tx.Table("platform_audit_logs").Create(map[string]interface{}{
		"id":                     utils.NewUUID(),
		"actor_appwrite_user_id": input.ActorAppwriteUserID,
		"actor_email":            input.ActorEmail,
		"action_type":            input.ActionType,
		"target_type":            input.TargetType,
		"target_id":              input.TargetID,
		"target_business_id":     input.TargetBusinessID,
		"reason":                 input.Reason,
		"before_data":            string(beforeData),
		"after_data":             string(afterData),
		"ip_address":             input.IPAddress,
		"user_agent":             input.UserAgent,
		"created_at":             time.Now().UTC(),
	}).Error
}
