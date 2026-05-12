package users

import "time"

type UserInvitation struct {
	ID         string     `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string     `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID   *string    `gorm:"type:uuid;index" json:"branch_id"`
	RoleID     string     `gorm:"type:uuid;not null;index" json:"role_id"`
	FullName   string     `gorm:"size:255;not null" json:"full_name"`
	Email      string     `gorm:"size:255;not null;index" json:"email"`
	Phone      string     `gorm:"size:100" json:"phone"`
	TokenHash  string     `gorm:"size:64;not null;uniqueIndex" json:"-"`
	Status     string     `gorm:"size:50;not null;index" json:"status"`
	ExpiresAt  time.Time  `json:"expires_at"`
	AcceptedAt *time.Time `json:"accepted_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (UserInvitation) TableName() string {
	return "user_invitations"
}
