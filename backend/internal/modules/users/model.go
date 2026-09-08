package users

import (
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/roles"
	"pastries-pos/internal/shared/utils"
)

type User struct {
	ID             string `gorm:"type:uuid;primaryKey" json:"id"`
	AppwriteUserID string `gorm:"size:100;not null;uniqueIndex" json:"appwrite_user_id"`
	// Null until this account exists in Supabase: backfilled for everyone by
	// the migration, and set at creation for anyone hired during the dual-run
	// window. A pointer because the partial unique index treats NULLs as
	// distinct and an empty string would collide on the second row.
	SupabaseUserID       *string        `gorm:"type:uuid" json:"supabase_user_id,omitempty"`
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

// ProviderIDs gathers this user's account ids across the identity providers, so
// lifecycle operations act on every system that knows about them. Leaving one
// provider untouched would let a deactivated employee keep signing in through
// it, and dual-verify would accept the result.
func (u User) ProviderIDs() utils.ProviderIDs {
	ids := utils.ProviderIDs{Appwrite: u.AppwriteUserID}
	if u.SupabaseUserID != nil {
		ids.Supabase = *u.SupabaseUserID
	}
	return ids
}
