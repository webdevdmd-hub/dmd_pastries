package roles

import (
	"strings"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/permissions"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db             *gorm.DB
	repo           *Repository
	permissionRepo *permissions.Repository
}

func NewService(db *gorm.DB, repo *Repository, permissionRepo *permissions.Repository) *Service {
	return &Service{
		db:             db,
		repo:           repo,
		permissionRepo: permissionRepo,
	}
}

func (s *Service) ListRoles(currentUser *utils.AuthContext) ([]RoleResponse, error) {
	roles, err := s.repo.ListByBusinessID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list roles")
	}

	response := make([]RoleResponse, 0, len(roles))
	for _, role := range roles {
		permissionKeys, err := s.repo.GetPermissionKeysByRoleID(role.ID)
		if err != nil {
			return nil, apperrors.Internal("failed to load role permissions")
		}

		response = append(response, RoleResponse{
			ID:              role.ID,
			BusinessID:      role.BusinessID,
			RoleName:        role.RoleName,
			Description:     role.Description,
			IsSystemDefault: role.IsSystemDefault,
			PermissionKeys:  visiblePermissionKeys(permissionKeys),
			CreatedAt:       role.CreatedAt,
			UpdatedAt:       role.UpdatedAt,
		})
	}

	return response, nil
}

func (s *Service) CreateRole(currentUser *utils.AuthContext, req CreateRoleRequest) (*RoleResponse, error) {
	roleName := strings.TrimSpace(req.RoleName)
	if roleName == "" {
		return nil, apperrors.BadRequest("role_name is required", nil)
	}

	normalizedKeys := make([]string, 0, len(req.PermissionKeys))
	seen := make(map[string]struct{}, len(req.PermissionKeys))
	for _, key := range req.PermissionKeys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalizedKeys = append(normalizedKeys, key)
	}

	if len(normalizedKeys) == 0 {
		return nil, apperrors.BadRequest("permission_keys must include at least one valid permission", nil)
	}

	exists, err := s.repo.ExistsByNameAndBusinessID(roleName, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate role name")
	}
	if exists {
		return nil, apperrors.Conflict("role name already exists for this business", nil)
	}

	permissionModels, err := s.permissionRepo.FindByKeys(normalizedKeys)
	if err != nil {
		return nil, apperrors.Internal("failed to validate permissions")
	}
	if len(permissionModels) != len(normalizedKeys) {
		found := make(map[string]struct{}, len(permissionModels))
		for _, permission := range permissionModels {
			found[permission.PermissionKey] = struct{}{}
		}

		missing := make([]string, 0)
		for _, key := range normalizedKeys {
			if _, ok := found[key]; !ok {
				missing = append(missing, key)
			}
		}

		return nil, apperrors.BadRequest("some permission_keys are invalid", map[string]interface{}{
			"invalid_permission_keys": missing,
		})
	}

	role := &Role{
		ID:              utils.NewUUID(),
		BusinessID:      &currentUser.BusinessID,
		RoleName:        roleName,
		Description:     strings.TrimSpace(req.Description),
		IsSystemDefault: false,
	}

	rolePermissions := make([]RolePermission, 0, len(permissionModels))
	for _, permission := range permissionModels {
		rolePermissions = append(rolePermissions, RolePermission{
			ID:           utils.NewUUID(),
			RoleID:       role.ID,
			PermissionID: permission.ID,
			Allowed:      true,
		})
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.Create(tx, role); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create role")
	}

	if err := s.repo.AttachPermissions(tx, rolePermissions); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to attach permissions to role")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit role creation")
	}

	return &RoleResponse{
		ID:              role.ID,
		BusinessID:      role.BusinessID,
		RoleName:        role.RoleName,
		Description:     role.Description,
		IsSystemDefault: role.IsSystemDefault,
		PermissionKeys:  visiblePermissionKeys(normalizedKeys),
		CreatedAt:       role.CreatedAt,
		UpdatedAt:       role.UpdatedAt,
	}, nil
}

func (s *Service) UpdateRole(currentUser *utils.AuthContext, roleID string, req UpdateRoleRequest) (*RoleResponse, error) {
	role, err := s.repo.FindByIDAndBusinessID(roleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("role not found")
		}
		return nil, apperrors.Internal("failed to load role")
	}

	if role.BusinessID == nil {
		return nil, apperrors.Forbidden("global system roles cannot be updated")
	}

	updates := map[string]interface{}{}
	var normalizedKeys []string
	replacePermissions := false

	if req.RoleName != nil {
		roleName := strings.TrimSpace(*req.RoleName)
		if roleName == "" {
			return nil, apperrors.BadRequest("role_name cannot be empty", nil)
		}
		if role.IsSystemDefault && !strings.EqualFold(roleName, role.RoleName) {
			return nil, apperrors.Forbidden("default role names cannot be updated")
		}
		if strings.EqualFold(roleName, role.RoleName) {
			roleName = role.RoleName
		}

		exists, err := s.repo.ExistsByNameAndBusinessIDExcludingID(roleName, currentUser.BusinessID, roleID)
		if err != nil {
			return nil, apperrors.Internal("failed to validate role name")
		}
		if exists {
			return nil, apperrors.Conflict("role name already exists for this business", nil)
		}

		updates["role_name"] = roleName
	}

	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}

	if req.PermissionKeys != nil {
		replacePermissions = true
		normalizedKeys = make([]string, 0, len(req.PermissionKeys))
		seen := make(map[string]struct{}, len(req.PermissionKeys))
		for _, key := range req.PermissionKeys {
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			normalizedKeys = append(normalizedKeys, key)
		}

		if len(normalizedKeys) == 0 {
			return nil, apperrors.BadRequest("permission_keys must include at least one valid permission", nil)
		}
		if isAdminRole(role) && !hasAllPermissionKeys(normalizedKeys) {
			return nil, apperrors.Forbidden("admin role must keep full permission access")
		}
	}

	if len(updates) == 0 && !replacePermissions {
		return nil, apperrors.BadRequest("no updatable fields provided", nil)
	}

	var permissionModels []permissions.Permission
	if replacePermissions {
		permissionModels, err = s.permissionRepo.FindByKeys(normalizedKeys)
		if err != nil {
			return nil, apperrors.Internal("failed to validate permissions")
		}
		if len(permissionModels) != len(normalizedKeys) {
			found := make(map[string]struct{}, len(permissionModels))
			for _, permission := range permissionModels {
				found[permission.PermissionKey] = struct{}{}
			}

			missing := make([]string, 0)
			for _, key := range normalizedKeys {
				if _, ok := found[key]; !ok {
					missing = append(missing, key)
				}
			}

			return nil, apperrors.BadRequest("some permission_keys are invalid", map[string]interface{}{
				"invalid_permission_keys": missing,
			})
		}
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if len(updates) > 0 {
		if err := s.repo.Update(tx, roleID, updates); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update role")
		}
	}

	if replacePermissions {
		rolePermissions := make([]RolePermission, 0, len(permissionModels))
		for _, permission := range permissionModels {
			rolePermissions = append(rolePermissions, RolePermission{
				ID:           utils.NewUUID(),
				RoleID:       roleID,
				PermissionID: permission.ID,
				Allowed:      true,
			})
		}

		if err := s.repo.ReplacePermissions(tx, roleID, rolePermissions); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update role permissions")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit role update")
	}

	updatedRole, err := s.repo.FindByIDAndBusinessID(roleID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload role")
	}

	permissionKeys, err := s.repo.GetPermissionKeysByRoleID(roleID)
	if err != nil {
		return nil, apperrors.Internal("failed to load updated role permissions")
	}

	return &RoleResponse{
		ID:              updatedRole.ID,
		BusinessID:      updatedRole.BusinessID,
		RoleName:        updatedRole.RoleName,
		Description:     updatedRole.Description,
		IsSystemDefault: updatedRole.IsSystemDefault,
		PermissionKeys:  visiblePermissionKeys(permissionKeys),
		CreatedAt:       updatedRole.CreatedAt,
		UpdatedAt:       updatedRole.UpdatedAt,
	}, nil
}

func (s *Service) DeleteRole(currentUser *utils.AuthContext, roleID string) error {
	role, err := s.repo.FindByIDAndBusinessID(roleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("role not found")
		}
		return apperrors.Internal("failed to load role")
	}

	if role.BusinessID == nil || role.IsSystemDefault {
		return apperrors.Forbidden("system roles cannot be deleted")
	}

	assignedUsersCount, err := s.repo.CountAssignedUsers(roleID, currentUser.BusinessID)
	if err != nil {
		return apperrors.Internal("failed to validate role assignments")
	}
	if assignedUsersCount > 0 {
		return apperrors.Conflict("role cannot be deleted while assigned to users", map[string]interface{}{
			"assigned_users_count": assignedUsersCount,
		})
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.ReplacePermissions(tx, roleID, nil); err != nil {
		tx.Rollback()
		return apperrors.Internal("failed to remove role permissions")
	}

	if err := s.repo.Delete(tx, roleID); err != nil {
		tx.Rollback()
		return apperrors.Internal("failed to delete role")
	}

	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit role deletion")
	}

	return nil
}

func (s *Service) GetRolePermissions(currentUser *utils.AuthContext, roleID string) (*RolePermissionsResponse, error) {
	role, err := s.repo.FindByIDAndBusinessID(roleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("role not found")
		}
		return nil, apperrors.Internal("failed to load role")
	}

	permissionKeys, err := s.repo.GetPermissionKeysByRoleID(role.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load role permissions")
	}

	return &RolePermissionsResponse{
		RoleID:          role.ID,
		RoleName:        role.RoleName,
		IsSystemDefault: role.IsSystemDefault,
		PermissionKeys:  visiblePermissionKeys(permissionKeys),
	}, nil
}

func (s *Service) UpdateRolePermissions(currentUser *utils.AuthContext, roleID string, req UpdateRolePermissionsRequest) (*RolePermissionsResponse, error) {
	role, err := s.repo.FindByIDAndBusinessID(roleID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("role not found")
		}
		return nil, apperrors.Internal("failed to load role")
	}

	if role.BusinessID == nil {
		return nil, apperrors.Forbidden("global system roles cannot be updated")
	}

	normalizedKeys := make([]string, 0, len(req.PermissionKeys))
	seen := make(map[string]struct{}, len(req.PermissionKeys))
	for _, key := range req.PermissionKeys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalizedKeys = append(normalizedKeys, key)
	}

	if len(normalizedKeys) == 0 {
		return nil, apperrors.BadRequest("permission_keys must include at least one valid permission", nil)
	}
	if isAdminRole(role) && !hasAllPermissionKeys(normalizedKeys) {
		return nil, apperrors.Forbidden("admin role must keep full permission access")
	}

	permissionModels, err := s.permissionRepo.FindByKeys(normalizedKeys)
	if err != nil {
		return nil, apperrors.Internal("failed to validate permissions")
	}
	if len(permissionModels) != len(normalizedKeys) {
		found := make(map[string]struct{}, len(permissionModels))
		for _, permission := range permissionModels {
			found[permission.PermissionKey] = struct{}{}
		}

		missing := make([]string, 0)
		for _, key := range normalizedKeys {
			if _, ok := found[key]; !ok {
				missing = append(missing, key)
			}
		}

		return nil, apperrors.BadRequest("some permission_keys are invalid", map[string]interface{}{
			"invalid_permission_keys": missing,
		})
	}

	rolePermissions := make([]RolePermission, 0, len(permissionModels))
	for _, permission := range permissionModels {
		rolePermissions = append(rolePermissions, RolePermission{
			ID:           utils.NewUUID(),
			RoleID:       roleID,
			PermissionID: permission.ID,
			Allowed:      true,
		})
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}

	if err := s.repo.ReplacePermissions(tx, roleID, rolePermissions); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update role permissions")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit role permission update")
	}

	return &RolePermissionsResponse{
		RoleID:          role.ID,
		RoleName:        role.RoleName,
		IsSystemDefault: role.IsSystemDefault,
		PermissionKeys:  visiblePermissionKeys(normalizedKeys),
	}, nil
}

func isAdminRole(role *Role) bool {
	if role == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(role.RoleName), "Admin")
}

func hasAllPermissionKeys(keys []string) bool {
	required := permissions.DefaultSeeds()
	if len(keys) < len(required) {
		return false
	}
	seen := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		seen[strings.TrimSpace(key)] = struct{}{}
	}
	for _, seed := range required {
		if _, ok := seen[seed.PermissionKey]; !ok {
			return false
		}
	}
	return true
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
