package roles

import (
	"fmt"

	"pastries-pos/internal/modules/permissions"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-056 — role editing had no ceiling.
//
// The default Manager role holds roles.create, roles.edit and
// roles.permissions.update, and nothing compared the permissions being granted
// with the editor's own: a Manager could add "accounting", "users.delete" or
// "close the books" to the Manager role and hold everything the owner does.
// Owner decision 2026-09-17: you can only grant permissions you already hold,
// only change roles that do not go beyond your access, and not your own role.

func grantingBeyondAccess(currentUser *utils.AuthContext, keys []string) error {
	if missing := permissions.UncoveredPermissions(currentUser.Permissions, keys); len(missing) > 0 {
		return apperrors.New(403, "You can't grant permissions you don't have.",
			map[string]interface{}{"missing_permissions": missing})
	}
	return nil
}

func (s *Service) ensureCanChangeRole(currentUser *utils.AuthContext, role *Role, changesPermissions bool) error {
	if changesPermissions && role.ID == currentUser.RoleID {
		return apperrors.Forbidden("You can't change the permissions of your own role. Ask another admin.")
	}
	keys, err := s.repo.GetPermissionKeysByRoleID(role.ID)
	if err != nil {
		return apperrors.Internal("failed to load role permissions")
	}
	if missing := permissions.UncoveredPermissions(currentUser.Permissions, keys); len(missing) > 0 {
		return apperrors.New(403, fmt.Sprintf("You can't change the %s role: it includes permissions you don't have.", role.RoleName),
			map[string]interface{}{"missing_permissions": missing})
	}
	return nil
}
