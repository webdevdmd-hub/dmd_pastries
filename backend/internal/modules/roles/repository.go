package roles

import (
	"gorm.io/gorm"

	"pastries-pos/internal/modules/permissions"
	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, role *Role) error {
	return tx.Create(role).Error
}

func (r *Repository) ExistsByNameAndBusinessID(roleName, businessID string) (bool, error) {
	var count int64
	err := r.db.Model(&Role{}).
		Where("LOWER(role_name) = LOWER(?) AND business_id = ?", roleName, businessID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) ExistsByNameAndBusinessIDExcludingID(roleName, businessID, excludedRoleID string) (bool, error) {
	var count int64
	err := r.db.Model(&Role{}).
		Where("LOWER(role_name) = LOWER(?) AND business_id = ? AND id <> ?", roleName, businessID, excludedRoleID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) ListByBusinessID(businessID string) ([]Role, error) {
	var roles []Role
	err := r.db.
		Where("business_id = ? OR business_id IS NULL", businessID).
		Order("is_system_default DESC, role_name ASC").
		Find(&roles).Error
	return roles, err
}

func (r *Repository) FindByIDAndBusinessID(roleID, businessID string) (*Role, error) {
	var role Role
	err := r.db.
		Where("id = ? AND (business_id = ? OR business_id IS NULL)", roleID, businessID).
		First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *Repository) AttachPermissions(tx *gorm.DB, rolePermissions []RolePermission) error {
	if len(rolePermissions) == 0 {
		return nil
	}
	return tx.Create(&rolePermissions).Error
}

func (r *Repository) ReplacePermissions(tx *gorm.DB, roleID string, rolePermissions []RolePermission) error {
	if err := tx.Where("role_id = ?", roleID).Delete(&RolePermission{}).Error; err != nil {
		return err
	}
	if len(rolePermissions) == 0 {
		return nil
	}
	return tx.Create(&rolePermissions).Error
}

func (r *Repository) Update(tx *gorm.DB, roleID string, updates map[string]interface{}) error {
	return tx.Model(&Role{}).Where("id = ?", roleID).Updates(updates).Error
}

func (r *Repository) Delete(tx *gorm.DB, roleID string) error {
	return tx.Delete(&Role{}, "id = ?", roleID).Error
}

func (r *Repository) CountAssignedUsers(roleID, businessID string) (int64, error) {
	var count int64
	err := r.db.Table("users").
		Where("role_id = ? AND business_id = ?", roleID, businessID).
		Count(&count).Error
	return count, err
}

func (r *Repository) CountByBusinessID(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&Role{}).Where("business_id = ? OR business_id IS NULL", businessID).Count(&count).Error
	return count, err
}

func (r *Repository) GetPermissionKeysByRoleID(roleID string) ([]string, error) {
	var permissionKeys []string
	err := r.db.Table("role_permissions").
		Select("permissions.permission_key").
		Joins("JOIN permissions ON permissions.id = role_permissions.permission_id").
		Where("role_permissions.role_id = ? AND role_permissions.allowed = ?", roleID, true).
		Scan(&permissionKeys).Error
	return permissionKeys, err
}

func (r *Repository) BackfillDefaultRolePermissions(tx *gorm.DB, presets map[string][]string) error {
	if len(presets) == 0 {
		return nil
	}

	roleNames := make([]string, 0, len(presets))
	permissionKeys := []string{}
	permissionKeySeen := map[string]bool{}
	for roleName, keys := range presets {
		roleNames = append(roleNames, roleName)
		for _, key := range keys {
			if !permissionKeySeen[key] {
				permissionKeys = append(permissionKeys, key)
				permissionKeySeen[key] = true
			}
		}
	}

	var defaultRoles []Role
	if err := tx.
		Where("role_name IN ? AND (is_system_default = ? OR role_name = ?)", roleNames, true, "Admin").
		Find(&defaultRoles).Error; err != nil {
		return err
	}

	var permissionRows []permissions.Permission
	if err := tx.Where("permission_key IN ?", permissionKeys).Find(&permissionRows).Error; err != nil {
		return err
	}

	permissionByKey := make(map[string]string, len(permissionRows))
	for _, permission := range permissionRows {
		permissionByKey[permission.PermissionKey] = permission.ID
	}

	rolePermissions := []RolePermission{}
	for _, role := range defaultRoles {
		for _, permissionKey := range presets[role.RoleName] {
			permissionID, exists := permissionByKey[permissionKey]
			if !exists {
				continue
			}

			var count int64
			if err := tx.Model(&RolePermission{}).
				Where("role_id = ? AND permission_id = ?", role.ID, permissionID).
				Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				continue
			}

			rolePermissions = append(rolePermissions, RolePermission{
				ID:           utils.NewUUID(),
				RoleID:       role.ID,
				PermissionID: permissionID,
				Allowed:      true,
			})
		}
	}

	if len(rolePermissions) == 0 {
		return nil
	}
	return tx.Create(&rolePermissions).Error
}
