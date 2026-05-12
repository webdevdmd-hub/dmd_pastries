package branches

import (
	"time"

	"gorm.io/gorm"
)

type Branch struct {
	ID            string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID    string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchName    string         `gorm:"size:255;not null" json:"branch_name"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	Code          string         `gorm:"size:50;not null;index" json:"code"`
	Address       string         `gorm:"size:500" json:"address"`
	Phone         string         `gorm:"size:100" json:"phone"`
	Email         string         `gorm:"size:255" json:"email"`
	ManagerUserID *string        `gorm:"type:uuid;index" json:"manager_user_id"`
	AddressLine1  string         `gorm:"size:255" json:"address_line_1"`
	AddressLine2  string         `gorm:"size:255" json:"address_line_2"`
	City          string         `gorm:"size:100" json:"city"`
	Country       string         `gorm:"size:100" json:"country"`
	Timezone      string         `gorm:"size:100" json:"timezone"`
	IsDefault     bool           `gorm:"not null;default:false" json:"is_default"`
	Status        string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Branch) TableName() string {
	return "branches"
}
