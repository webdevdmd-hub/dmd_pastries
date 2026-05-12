package users

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/branches"
	"pastries-pos/internal/modules/businesses"
	"pastries-pos/internal/modules/roles"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db             *gorm.DB
	appwriteClient *utils.AppwriteClient
	repo           *Repository
	roleRepo       *roles.Repository
	branchRepo     *branches.Repository
	businessRepo   *businesses.Repository
	auditRepo      *audit.Repository
}

func NewService(
	db *gorm.DB,
	appwriteClient *utils.AppwriteClient,
	repo *Repository,
	roleRepo *roles.Repository,
	branchRepo *branches.Repository,
	businessRepo *businesses.Repository,
	auditRepo *audit.Repository,
) *Service {
	return &Service{
		db:             db,
		appwriteClient: appwriteClient,
		repo:           repo,
		roleRepo:       roleRepo,
		branchRepo:     branchRepo,
		businessRepo:   businessRepo,
		auditRepo:      auditRepo,
	}
}

func (s *Service) ListUsers(currentUser *utils.AuthContext) ([]UserResponse, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	users, err := s.repo.ListByBusinessID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list users")
	}

	response := make([]UserResponse, 0, len(users))
	for _, user := range users {
		if !allBranches && (user.BranchID == nil || *user.BranchID != branchID) {
			continue
		}
		response = append(response, toUserResponse(user))
	}

	return response, nil
}

func (s *Service) GetUser(currentUser *utils.AuthContext, userID string) (*UserResponse, error) {
	user, err := s.repo.FindByIDAndBusinessID(userID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to fetch user")
	}
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	if !allBranches && (user.BranchID == nil || *user.BranchID != branchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}

	response := toUserResponse(*user)
	return &response, nil
}

func (s *Service) CreateInvitation(currentUser *utils.AuthContext, req CreateInvitationRequest, ipAddress, userAgent string) (*InvitationResponse, error) {
	role, err := s.roleRepo.FindByIDAndBusinessID(req.RoleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid role_id", nil)
		}
		return nil, apperrors.Internal("failed to load role")
	}

	if err := s.validateBranch(currentUser.BusinessID, req.BranchID); err != nil {
		return nil, err
	}
	if req.BranchID != nil {
		resolvedBranchID, err := currentUser.ResolveOperationalBranch(*req.BranchID)
		if err != nil {
			return nil, err
		}
		req.BranchID = &resolvedBranchID
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	exists, err := s.repo.ExistsByEmailAndBusinessID(email, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate user email")
	}
	if exists {
		return nil, apperrors.Conflict("user already exists in this business", nil)
	}

	pendingExists, err := s.repo.ExistsPendingInvitation(email, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate invitation")
	}
	if pendingExists {
		return nil, apperrors.Conflict("pending invitation already exists for this email", nil)
	}

	token, tokenHash, err := generateInvitationToken()
	if err != nil {
		return nil, apperrors.Internal("failed to generate invitation token")
	}

	invite := &UserInvitation{
		ID:         utils.NewUUID(),
		BusinessID: currentUser.BusinessID,
		BranchID:   req.BranchID,
		RoleID:     role.ID,
		FullName:   strings.TrimSpace(req.FullName),
		Email:      email,
		Phone:      strings.TrimSpace(req.Phone),
		TokenHash:  tokenHash,
		Status:     "pending",
		ExpiresAt:  time.Now().UTC().AddDate(0, 0, 7),
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.CreateInvitation(tx, invite); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create invitation")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "user.invited",
		EntityType:  "user",
		EntityID:    invite.ID,
		Summary:     "Staff invitation created.",
		Metadata: map[string]interface{}{
			"email": invite.Email,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit invitation")
	}

	response := toInvitationResponse(*invite)
	response.Token = token
	return &response, nil
}

func (s *Service) ListInvitations(currentUser *utils.AuthContext, status string) ([]InvitationResponse, error) {
	invites, err := s.repo.ListInvitations(currentUser.BusinessID, status)
	if err != nil {
		return nil, apperrors.Internal("failed to list invitations")
	}

	response := make([]InvitationResponse, 0, len(invites))
	for _, invite := range invites {
		response = append(response, toInvitationResponse(invite))
	}
	return response, nil
}

func (s *Service) ResendInvitation(currentUser *utils.AuthContext, invitationID, ipAddress, userAgent string) (*InvitationActionResponse, error) {
	invite, err := s.repo.FindInvitationByIDAndBusinessID(invitationID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("invitation not found")
		}
		return nil, apperrors.Internal("failed to fetch invitation")
	}
	if invite.Status != "pending" {
		return nil, apperrors.BadRequest("only pending invitations can be resent", nil)
	}

	token, tokenHash, err := generateInvitationToken()
	if err != nil {
		return nil, apperrors.Internal("failed to generate invitation token")
	}

	expiresAt := time.Now().UTC().AddDate(0, 0, 7)
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.UpdateInvitation(tx, invite.ID, map[string]interface{}{
		"token_hash": tokenHash,
		"expires_at": expiresAt,
		"updated_at": time.Now().UTC(),
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update invitation")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "user.invitation_resent",
		EntityType:  "user",
		EntityID:    invite.ID,
		Summary:     "Staff invitation resent.",
		Metadata:    map[string]interface{}{"email": invite.Email},
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit invitation resend")
	}

	return &InvitationActionResponse{ID: invite.ID, Status: "pending", ExpiresAt: expiresAt, UpdatedAt: time.Now().UTC(), Token: token}, nil
}

func (s *Service) CancelInvitation(currentUser *utils.AuthContext, invitationID, ipAddress, userAgent string) (*InvitationActionResponse, error) {
	invite, err := s.repo.FindInvitationByIDAndBusinessID(invitationID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("invitation not found")
		}
		return nil, apperrors.Internal("failed to fetch invitation")
	}
	if invite.Status != "pending" {
		return nil, apperrors.BadRequest("only pending invitations can be cancelled", nil)
	}

	now := time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.UpdateInvitation(tx, invite.ID, map[string]interface{}{
		"status":     "cancelled",
		"updated_at": now,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to cancel invitation")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "user.invitation_cancelled",
		EntityType:  "user",
		EntityID:    invite.ID,
		Summary:     "Staff invitation cancelled.",
		Metadata:    map[string]interface{}{"email": invite.Email},
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit invitation cancellation")
	}

	return &InvitationActionResponse{ID: invite.ID, Status: "cancelled", UpdatedAt: now}, nil
}

func (s *Service) AcceptInvitation(req AcceptInvitationRequest, ipAddress, userAgent string) (*AcceptInvitationResponse, error) {
	if !utils.PasswordsMatch(req.Password, req.ConfirmPassword) {
		return nil, apperrors.BadRequest("password and confirm_password must match", nil)
	}

	tokenHash := hashToken(req.Token)
	invite, err := s.repo.FindInvitationByTokenHash(tokenHash)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.Unauthorized("invalid invitation token")
		}
		return nil, apperrors.Internal("failed to load invitation")
	}
	if invite.Status != "pending" {
		return nil, apperrors.BadRequest("invitation is not pending", nil)
	}
	if time.Now().UTC().After(invite.ExpiresAt) {
		_ = s.repo.UpdateInvitation(s.db, invite.ID, map[string]interface{}{"status": "expired"})
		return nil, apperrors.BadRequest("invitation has expired", nil)
	}

	exists, err := s.repo.ExistsByEmailAndBusinessID(invite.Email, invite.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate user email")
	}
	if exists {
		return nil, apperrors.Conflict("user already exists in this business", nil)
	}

	appwriteUserID, err := s.appwriteClient.CreateUser(invite.Email, req.Password, invite.FullName, invite.Phone)
	if err != nil {
		message, details := utils.FriendlyAppwriteCreateUserError(err)
		return nil, apperrors.BadRequest(message, details)
	}

	user := &User{
		ID:              utils.NewUUID(),
		AppwriteUserID:  appwriteUserID,
		BusinessID:      invite.BusinessID,
		BranchID:        invite.BranchID,
		CurrentBranchID: invite.BranchID,
		RoleID:          invite.RoleID,
		FullName:        invite.FullName,
		Email:           invite.Email,
		Phone:           invite.Phone,
		Status:          "active",
	}

	now := time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.Create(tx, user); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create user")
	}
	if user.BranchID != nil {
		if err := s.repo.EnsureBranchAccess(tx, user.BusinessID, user.ID, *user.BranchID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to grant branch access")
		}
	}
	if err := s.repo.UpdateInvitation(tx, invite.ID, map[string]interface{}{
		"status":      "accepted",
		"accepted_at": now,
		"updated_at":  now,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to accept invitation")
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   invite.BusinessID,
		ActorUserID:  user.ID,
		TargetUserID: &user.ID,
		EventType:    "user.invitation_accepted",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "Staff invitation accepted.",
		Metadata:     map[string]interface{}{"invitation_id": invite.ID},
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit invitation acceptance")
	}

	return &AcceptInvitationResponse{
		UserID:         user.ID,
		AppwriteUserID: user.AppwriteUserID,
		BusinessID:     user.BusinessID,
		BranchID:       user.BranchID,
		RoleID:         user.RoleID,
		Status:         user.Status,
	}, nil
}

func (s *Service) CreateUser(currentUser *utils.AuthContext, req CreateUserRequest, ipAddress, userAgent string) (*UserResponse, error) {
	role, err := s.roleRepo.FindByIDAndBusinessID(req.RoleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid role_id", nil)
		}
		return nil, apperrors.Internal("failed to load role")
	}

	if err := s.validateBranch(currentUser.BusinessID, req.BranchID); err != nil {
		return nil, err
	}
	if req.BranchID != nil {
		resolvedBranchID, err := currentUser.ResolveOperationalBranch(*req.BranchID)
		if err != nil {
			return nil, err
		}
		req.BranchID = &resolvedBranchID
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	exists, err := s.repo.ExistsByEmailAndBusinessID(email, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate user email")
	}
	if exists {
		return nil, apperrors.Conflict("user email already exists in this business", nil)
	}

	userID := utils.NewUUID()
	user := &User{
		ID:              userID,
		AppwriteUserID:  "pending-" + userID,
		BusinessID:      currentUser.BusinessID,
		BranchID:        req.BranchID,
		CurrentBranchID: req.BranchID,
		RoleID:          role.ID,
		FullName:        req.FullName,
		Email:           email,
		Phone:           req.Phone,
		AvatarFileID:    strings.TrimSpace(req.AvatarFileID),
		Status:          "active",
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := s.repo.Create(tx, user); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create local user")
	}
	if user.BranchID != nil {
		if err := s.repo.EnsureBranchAccess(tx, user.BusinessID, user.ID, *user.BranchID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to grant branch access")
		}
	}

	appwriteUserID, err := s.appwriteClient.CreateUser(req.Email, req.Password, req.FullName, req.Phone)
	if err != nil {
		tx.Rollback()
		message, details := utils.FriendlyAppwriteCreateUserError(err)
		return nil, apperrors.BadRequest(message, details)
	}
	user.AppwriteUserID = appwriteUserID
	if err := s.repo.UpdateAppwriteUserID(tx, user.ID, appwriteUserID); err != nil {
		tx.Rollback()
		_ = s.appwriteClient.DeleteUser(appwriteUserID)
		return nil, apperrors.Internal("failed to link Appwrite user")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &user.ID,
		EventType:    "user.created",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "Staff user created.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit user creation")
	}

	response := toUserResponse(*user)
	response.RoleName = role.RoleName
	return &response, nil
}

func (s *Service) InviteUser(currentUser *utils.AuthContext, req InviteUserRequest, ipAddress, userAgent string) (*InviteUserResponse, error) {
	role, err := s.roleRepo.FindByIDAndBusinessID(req.RoleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid role_id", nil)
		}
		return nil, apperrors.Internal("failed to load role")
	}

	if err := s.validateBranch(currentUser.BusinessID, req.BranchID); err != nil {
		return nil, err
	}
	if req.BranchID != nil {
		resolvedBranchID, err := currentUser.ResolveOperationalBranch(*req.BranchID)
		if err != nil {
			return nil, err
		}
		req.BranchID = &resolvedBranchID
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	exists, err := s.repo.ExistsByEmailAndBusinessID(email, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate user email")
	}
	if exists {
		return nil, apperrors.Conflict("user email already exists in this business", nil)
	}

	temporaryPassword, err := generateTemporaryPassword()
	if err != nil {
		return nil, apperrors.Internal("failed to generate temporary password")
	}

	appwriteUserID, err := s.appwriteClient.CreateUser(req.Email, temporaryPassword, req.FullName, req.Phone)
	if err != nil {
		message, details := utils.FriendlyAppwriteCreateUserError(err)
		return nil, apperrors.BadRequest(message, details)
	}

	user := &User{
		ID:              utils.NewUUID(),
		AppwriteUserID:  appwriteUserID,
		BusinessID:      currentUser.BusinessID,
		BranchID:        req.BranchID,
		CurrentBranchID: req.BranchID,
		RoleID:          role.ID,
		FullName:        strings.TrimSpace(req.FullName),
		Email:           email,
		Phone:           strings.TrimSpace(req.Phone),
		AvatarFileID:    strings.TrimSpace(req.AvatarFileID),
		Status:          "invited",
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.Create(tx, user); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create invited local user")
	}
	if user.BranchID != nil {
		if err := s.repo.EnsureBranchAccess(tx, user.BusinessID, user.ID, *user.BranchID); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to grant branch access")
		}
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &user.ID,
		EventType:    "user.invited",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "Staff user invited.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit user invite")
	}

	response := toUserResponse(*user)
	response.RoleName = role.RoleName
	return &InviteUserResponse{
		User:              response,
		TemporaryPassword: temporaryPassword,
		Message:           "temporary password is returned once; send it securely or replace with Appwrite email invitation flow later",
	}, nil
}

func (s *Service) UpdateUser(currentUser *utils.AuthContext, userID string, req UpdateUserRequest, ipAddress, userAgent string) (*UserResponse, error) {
	user, err := s.repo.FindByIDAndBusinessID(userID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to fetch user")
	}

	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.RoleID != nil {
		role, err := s.roleRepo.FindByIDAndBusinessID(*req.RoleID, currentUser.BusinessID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, apperrors.BadRequest("invalid role_id", nil)
			}
			return nil, apperrors.Internal("failed to load role")
		}
		updates["role_id"] = role.ID
	}
	if req.BranchID != nil {
		resolvedBranchID, err := s.resolveAssignableBranch(currentUser, req.BranchID)
		if err != nil {
			return nil, err
		}
		updates["branch_id"] = resolvedBranchID
		updates["current_branch_id"] = resolvedBranchID
	}
	if req.AvatarFileID != nil {
		updates["avatar_file_id"] = strings.TrimSpace(*req.AvatarFileID)
	}

	if len(updates) == 0 {
		return nil, apperrors.BadRequest("no updatable fields provided", nil)
	}

	updates["updated_at"] = time.Now().UTC()
	if err := s.repo.UpdateByBusinessID(user.ID, currentUser.BusinessID, updates); err != nil {
		return nil, err
	}
	if req.BranchID != nil {
		if err := s.repo.EnsureBranchAccess(s.db, currentUser.BusinessID, user.ID, updates["branch_id"].(string)); err != nil {
			return nil, apperrors.Internal("failed to grant branch access")
		}
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &user.ID,
		EventType:    "user.updated",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "Staff user updated.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit user update")
	}

	updated, err := s.repo.FindByIDAndBusinessID(user.ID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload user")
	}

	response := toUserResponse(*updated)
	return &response, nil
}

func (s *Service) DeleteUser(currentUser *utils.AuthContext, userID string, ipAddress, userAgent string) (*DeleteUserResponse, error) {
	if currentUser.UserID == userID {
		return nil, apperrors.BadRequest("you cannot delete your own user account", nil)
	}

	user, err := s.repo.FindByIDAndBusinessID(userID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to fetch user")
	}

	business, err := s.businessRepo.FindByID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load business")
	}
	if business.OwnerUserID != nil && *business.OwnerUserID == user.ID {
		return nil, apperrors.BadRequest("business owner cannot be deleted", nil)
	}
	if strings.EqualFold(user.Role.RoleName, "admin") {
		adminCount, err := s.repo.CountActiveAdmins(currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.Internal("failed to validate active admins")
		}
		if adminCount <= 1 {
			return nil, apperrors.BadRequest("cannot delete the only active admin", nil)
		}
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.UpdateByBusinessIDTx(tx, user.ID, currentUser.BusinessID, map[string]interface{}{
		"status":     "deleted",
		"updated_at": time.Now().UTC(),
	}); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.repo.SoftDeleteByBusinessID(tx, user.ID, currentUser.BusinessID); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &user.ID,
		EventType:    "user.soft_deleted",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "User was soft-deleted.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit user deletion")
	}

	_ = s.appwriteClient.DeleteUserSessions(user.AppwriteUserID)
	_ = s.appwriteClient.SetUserStatus(user.AppwriteUserID, false)

	deleted, err := s.repo.FindByIDAndBusinessIDUnscoped(user.ID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload deleted user")
	}

	deletedAt := deleted.DeletedAt.Time
	return &DeleteUserResponse{ID: deleted.ID, Status: "deleted", DeletedAt: &deletedAt}, nil
}

func (s *Service) RestoreUser(currentUser *utils.AuthContext, userID string, ipAddress, userAgent string) (*UserResponse, error) {
	user, err := s.repo.FindByIDAndBusinessIDUnscoped(userID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to fetch user")
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.RestoreByBusinessID(tx, user.ID, currentUser.BusinessID); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &user.ID,
		EventType:    "user.restored",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "User was restored.",
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit user restore")
	}

	_ = s.appwriteClient.SetUserStatus(user.AppwriteUserID, true)

	restored, err := s.repo.FindByIDAndBusinessID(user.ID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload user")
	}
	response := toUserResponse(*restored)
	return &response, nil
}

func (s *Service) AssignUserBranch(currentUser *utils.AuthContext, userID string, req AssignBranchRequest, ipAddress, userAgent string) (*UserResponse, error) {
	resolvedBranchID, err := s.resolveAssignableBranch(currentUser, req.BranchID)
	if err != nil {
		return nil, err
	}
	req.BranchID = &resolvedBranchID

	user, err := s.repo.FindByIDAndBusinessID(userID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to fetch user")
	}

	if err := s.repo.UpdateByBusinessID(user.ID, currentUser.BusinessID, map[string]interface{}{
		"branch_id":         resolvedBranchID,
		"current_branch_id": resolvedBranchID,
		"updated_at":        time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	if err := s.repo.EnsureBranchAccess(s.db, currentUser.BusinessID, user.ID, resolvedBranchID); err != nil {
		return nil, apperrors.Internal("failed to grant branch access")
	}

	if err := s.auditRepo.CreateActivity(s.db, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &user.ID,
		EventType:    "user.branch_assigned",
		EntityType:   "user",
		EntityID:     user.ID,
		Summary:      "User branch assignment changed.",
		Metadata:     map[string]interface{}{"branch_id": resolvedBranchID},
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		return nil, apperrors.Internal("failed to create activity log")
	}

	updated, err := s.repo.FindByIDAndBusinessID(user.ID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload user")
	}
	response := toUserResponse(*updated)
	return &response, nil
}

func (s *Service) GetUserActivity(currentUser *utils.AuthContext, userID, cursor, limitValue string) (*audit.ActivityLogListResponse, error) {
	if _, err := s.repo.FindByIDAndBusinessIDUnscoped(userID, currentUser.BusinessID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to fetch user")
	}

	limit := 50
	if limitValue != "" {
		parsed, err := strconv.Atoi(limitValue)
		if err != nil {
			return nil, apperrors.BadRequest("invalid limit", nil)
		}
		limit = parsed
	}

	logs, nextCursorValue, err := s.auditRepo.ListActivity(currentUser.BusinessID, "", userID, cursor, limit)
	if err != nil {
		return nil, apperrors.Internal("failed to load user activity")
	}

	items := make([]audit.ActivityLogResponse, 0, len(logs))
	for _, log := range logs {
		items = append(items, audit.ToActivityLogResponse(log))
	}

	var nextCursor *string
	if nextCursorValue != "" {
		nextCursor = &nextCursorValue
	}
	return &audit.ActivityLogListResponse{Items: items, NextCursor: nextCursor}, nil
}

func (s *Service) UpdateUserStatus(currentUser *utils.AuthContext, userID string, req UpdateUserStatusRequest, ipAddress, userAgent string) (*UserResponse, error) {
	if err := s.repo.UpdateByBusinessID(userID, currentUser.BusinessID, map[string]interface{}{
		"status":     req.Status,
		"updated_at": time.Now().UTC(),
	}); err != nil {
		return nil, err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:   currentUser.BusinessID,
		ActorUserID:  currentUser.UserID,
		TargetUserID: &userID,
		EventType:    "user.status_changed",
		EntityType:   "user",
		EntityID:     userID,
		Summary:      "User status changed.",
		Metadata:     map[string]interface{}{"to_status": req.Status},
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create audit log")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit status update")
	}

	updated, err := s.repo.FindByIDAndBusinessID(userID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, apperrors.Internal("failed to reload user")
	}

	response := toUserResponse(*updated)
	return &response, nil
}

func toUserResponse(user User) UserResponse {
	return UserResponse{
		ID:             user.ID,
		AppwriteUserID: user.AppwriteUserID,
		BusinessID:     user.BusinessID,
		BranchID:       user.BranchID,
		RoleID:         user.RoleID,
		RoleName:       user.Role.RoleName,
		FullName:       user.FullName,
		Email:          user.Email,
		Phone:          user.Phone,
		AvatarFileID:   user.AvatarFileID,
		Status:         user.Status,
		EmailVerified:  user.EmailVerified,
		LastLoginAt:    user.LastLoginAt,
		CreatedAt:      user.CreatedAt,
		UpdatedAt:      user.UpdatedAt,
	}
}

func toInvitationResponse(invite UserInvitation) InvitationResponse {
	return InvitationResponse{
		ID:         invite.ID,
		BusinessID: invite.BusinessID,
		BranchID:   invite.BranchID,
		RoleID:     invite.RoleID,
		FullName:   invite.FullName,
		Email:      invite.Email,
		Phone:      invite.Phone,
		Status:     invite.Status,
		ExpiresAt:  invite.ExpiresAt,
		AcceptedAt: invite.AcceptedAt,
		CreatedAt:  invite.CreatedAt,
		UpdatedAt:  invite.UpdatedAt,
	}
}

func (s *Service) validateBranch(businessID string, branchID *string) error {
	if branchID == nil || *branchID == "" {
		return nil
	}

	branch, err := s.branchRepo.FindByIDAndBusinessID(*branchID, businessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.BadRequest("invalid branch_id", nil)
		}
		return apperrors.Internal("failed to load branch")
	}
	if branch.Status != "active" {
		return apperrors.BadRequest("branch is inactive", nil)
	}
	return nil
}

func (s *Service) resolveAssignableBranch(currentUser *utils.AuthContext, branchID *string) (string, error) {
	if branchID == nil || strings.TrimSpace(*branchID) == "" {
		return "", apperrors.BadRequest("branch_id is required", nil)
	}
	resolvedBranchID := strings.TrimSpace(*branchID)
	if err := s.validateBranch(currentUser.BusinessID, &resolvedBranchID); err != nil {
		return "", err
	}
	if currentUser.CanAccessAllBranches || currentUser.CanAccessBranch(resolvedBranchID) {
		return resolvedBranchID, nil
	}
	return "", apperrors.Forbidden("branch access denied")
}

func generateTemporaryPassword() (string, error) {
	randomBytes := make([]byte, 18)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return "Tmp-" + base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

func generateInvitationToken() (string, string, error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", err
	}
	token := base64.RawURLEncoding.EncodeToString(randomBytes)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
