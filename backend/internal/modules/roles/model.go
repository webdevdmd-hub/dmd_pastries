package roles

import (
	"time"

	"gorm.io/gorm"
)

type Role struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      *string        `gorm:"type:uuid;index" json:"business_id"`
	RoleName        string         `gorm:"size:100;not null" json:"role_name"`
	Description     string         `gorm:"size:255" json:"description"`
	IsSystemDefault bool           `gorm:"not null;default:false" json:"is_system_default"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Role) TableName() string {
	return "roles"
}

type RolePermission struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	RoleID       string    `gorm:"type:uuid;not null;index" json:"role_id"`
	PermissionID string    `gorm:"type:uuid;not null;index" json:"permission_id"`
	Allowed      bool      `gorm:"not null;default:true" json:"allowed"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (RolePermission) TableName() string {
	return "role_permissions"
}
