package permissions

import "time"

type PermissionResponse struct {
	ID            string    `json:"id"`
	ModuleName    string    `json:"module_name"`
	PermissionKey string    `json:"permission_key"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type PermissionGroupResponse struct {
	ModuleName  string               `json:"module_name"`
	Permissions []PermissionResponse `json:"permissions"`
}
