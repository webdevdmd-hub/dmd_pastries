package businesses

import (
	"time"

	"gorm.io/gorm"
)

type Business struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessName string         `gorm:"size:255;not null" json:"business_name"`
	OwnerUserID  *string        `gorm:"type:uuid" json:"owner_user_id"`
	Currency     string         `gorm:"size:10;not null" json:"currency"`
	Timezone     string         `gorm:"size:100;not null" json:"timezone"`
	VATNumber    string         `gorm:"size:100" json:"vat_number"`
	Status       string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Business) TableName() string {
	return "businesses"
}
