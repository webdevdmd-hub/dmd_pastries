package roles

import "time"

type CreateRoleRequest struct {
	RoleName       string   `json:"role_name" binding:"required"`
	Description    string   `json:"description"`
	PermissionKeys []string `json:"permission_keys" binding:"required,min=1"`
}

type UpdateRoleRequest struct {
	RoleName       *string  `json:"role_name"`
	Description    *string  `json:"description"`
	PermissionKeys []string `json:"permission_keys"`
}

type UpdateRolePermissionsRequest struct {
	PermissionKeys []string `json:"permission_keys" binding:"required,min=1"`
}

type RolePermissionsResponse struct {
	RoleID          string   `json:"role_id"`
	RoleName        string   `json:"role_name"`
	IsSystemDefault bool     `json:"is_system_default"`
	PermissionKeys  []string `json:"permission_keys"`
}

type RoleResponse struct {
	ID              string    `json:"id"`
	BusinessID      *string   `json:"business_id"`
	RoleName        string    `json:"role_name"`
	Description     string    `json:"description"`
	IsSystemDefault bool      `json:"is_system_default"`
	PermissionKeys  []string  `json:"permission_keys,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
