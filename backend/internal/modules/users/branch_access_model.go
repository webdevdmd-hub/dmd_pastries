package users

import "time"

type UserBranchAccess struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string    `gorm:"type:uuid;not null;index" json:"business_id"`
	UserID     string    `gorm:"type:uuid;not null;index" json:"user_id"`
	BranchID   string    `gorm:"type:uuid;not null;index" json:"branch_id"`
	CreatedAt  time.Time `json:"created_at"`
}

func (UserBranchAccess) TableName() string {
	return "user_branch_access"
}
