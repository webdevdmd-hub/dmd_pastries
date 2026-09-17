package users

import (
	"fmt"
	"strings"

	"pastries-pos/internal/modules/permissions"
	"pastries-pos/internal/modules/roles"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-056 — anyone who could manage staff could hand out any role.
//
// The default Manager role holds users.create, users.edit and
// users.status.update, and nothing compared the role being given with the
// giver's own access: a Manager could create an Admin, promote a Cashier to
// Admin, resend an Admin invitation and accept it, mint a password-reset link
// for an Admin, or suspend the business owner. Owner decision 2026-09-17: you
// can only give or act on a role whose permissions you already hold.

// ensureCanGrantRole refuses to assign a role that carries permissions the
// caller does not have.
func (s *Service) ensureCanGrantRole(currentUser *utils.AuthContext, role *roles.Role) error {
	keys, err := s.roleRepo.GetPermissionKeysByRoleID(role.ID)
	if err != nil {
		return apperrors.Internal("failed to load role permissions")
	}
	if missing := permissions.UncoveredPermissions(currentUser.Permissions, keys); len(missing) > 0 {
		return apperrors.New(403, fmt.Sprintf("You can't give the %s role: it includes permissions you don't have.", role.RoleName),
			map[string]interface{}{"missing_permissions": missing})
	}
	return nil
}

// ensureCanGrantInvitationRole applies ensureCanGrantRole to a pending
// invitation's role.
func (s *Service) ensureCanGrantInvitationRole(currentUser *utils.AuthContext, invite *UserInvitation) error {
	role, err := s.roleRepo.FindByIDAndBusinessID(invite.RoleID, currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to load invitation role")
	}
	return s.ensureCanGrantRole(currentUser, role)
}

// ensureCanManageUser refuses changes to a colleague whose role goes beyond
// the caller's access: editing, suspending, deleting, restoring, moving them
// between branches, or issuing their password-reset link.
func (s *Service) ensureCanManageUser(currentUser *utils.AuthContext, user *User) error {
	keys, err := s.roleRepo.GetPermissionKeysByRoleID(user.RoleID)
	if err != nil {
		return apperrors.Internal("failed to load role permissions")
	}
	if missing := permissions.UncoveredPermissions(currentUser.Permissions, keys); len(missing) > 0 {
		name := strings.TrimSpace(user.FullName)
		if name == "" {
			name = "this user"
		}
		return apperrors.New(403, fmt.Sprintf("You can't change %s: their role includes permissions you don't have.", name),
			map[string]interface{}{"missing_permissions": missing})
	}
	return nil
}

// ensureAccessKept stops a change that would lock the business out: the
// owner's role and status are fixed, and the last active admin cannot be
// deactivated or moved to another role.
func (s *Service) ensureAccessKept(currentUser *utils.AuthContext, user *User, newStatus string, newRole *roles.Role) error {
	losesStatus := newStatus != "" && newStatus != "active"
	losesRole := newRole != nil && newRole.ID != user.RoleID
	if !losesStatus && !losesRole {
		return nil
	}
	business, err := s.businessRepo.FindByID(currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to load business")
	}
	if business.OwnerUserID != nil && *business.OwnerUserID == user.ID {
		return apperrors.BadRequest("The business owner's role and status can't be changed.", nil)
	}
	isActiveAdmin := user.Status == "active" && strings.EqualFold(user.Role.RoleName, "admin")
	staysAdmin := newRole == nil || strings.EqualFold(newRole.RoleName, "admin")
	if isActiveAdmin && (losesStatus || !staysAdmin) {
		count, err := s.repo.CountActiveAdmins(currentUser.BusinessID)
		if err != nil {
			return apperrors.Internal("failed to validate active admins")
		}
		if count <= 1 {
			return apperrors.BadRequest("This is the only active admin. Make someone else an admin first.", nil)
		}
	}
	return nil
}
