package users

import (
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/roles"
)

type User struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	AppwriteUserID       string         `gorm:"size:100;not null;uniqueIndex" json:"appwrite_user_id"`
	BusinessID           string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID             *string        `gorm:"type:uuid;index" json:"branch_id"`
	CurrentBranchID      *string        `gorm:"type:uuid;index" json:"current_branch_id"`
	CanAccessAllBranches bool           `gorm:"not null;default:false" json:"can_access_all_branches"`
	RoleID               string         `gorm:"type:uuid;not null;index" json:"role_id"`
	FullName             string         `gorm:"size:255;not null" json:"full_name"`
	Email                string         `gorm:"size:255;not null;index" json:"email"`
	Phone                string         `gorm:"size:100" json:"phone"`
	AvatarFileID         string         `gorm:"size:500" json:"avatar_file_id"`
	Status               string         `gorm:"size:50;not null;default:active" json:"status"`
	EmailVerified        bool           `gorm:"not null;default:false" json:"email_verified"`
	LastLoginAt          *time.Time     `json:"last_login_at"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	Role                 roles.Role     `gorm:"foreignKey:RoleID" json:"role"`
}

func (User) TableName() string {
	return "users"
}
