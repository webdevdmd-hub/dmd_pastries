package permissions

import "time"

type Permission struct {
	ID            string    `gorm:"type:uuid;primaryKey" json:"id"`
	ModuleName    string    `gorm:"size:100;not null;index" json:"module_name"`
	PermissionKey string    `gorm:"size:150;not null;uniqueIndex" json:"permission_key"`
	Description   string    `gorm:"size:255" json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (Permission) TableName() string {
	return "permissions"
}
