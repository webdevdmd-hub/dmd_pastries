package customers

import (
	"time"

	"gorm.io/gorm"
)

type Customer struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CustomerCode    string         `gorm:"size:100;not null" json:"customer_code"`
	FullName        string         `gorm:"size:255;not null" json:"full_name"`
	Phone           string         `gorm:"size:100" json:"phone"`
	Email           string         `gorm:"size:255" json:"email"`
	DateOfBirth     *time.Time     `gorm:"type:date" json:"date_of_birth"`
	Gender          *string        `gorm:"size:50" json:"gender"`
	AddressLine1    string         `gorm:"column:address_line_1;size:255" json:"address_line_1"`
	AddressLine2    string         `gorm:"column:address_line_2;size:255" json:"address_line_2"`
	City            string         `gorm:"size:100" json:"city"`
	State           string         `gorm:"size:100" json:"state"`
	Country         string         `gorm:"size:100" json:"country"`
	PostalCode      string         `gorm:"size:50" json:"postal_code"`
	Notes           string         `json:"notes"`
	Status          string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedByUserID string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Customer) TableName() string {
	return "customers"
}

type CustomerTag struct {
	ID         string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID   string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	TagName    string         `gorm:"size:100;not null" json:"tag_name"`
	Color      string         `gorm:"size:50" json:"color"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (CustomerTag) TableName() string {
	return "customer_tags"
}

type CustomerTagMapping struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID   string    `gorm:"type:uuid;not null;index" json:"branch_id"`
	CustomerID string    `gorm:"type:uuid;not null;index" json:"customer_id"`
	TagID      string    `gorm:"type:uuid;not null;index" json:"tag_id"`
	CreatedAt  time.Time `json:"created_at"`
}

func (CustomerTagMapping) TableName() string {
	return "customer_tag_mappings"
}

type CustomerNote struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CustomerID      string         `gorm:"type:uuid;not null;index" json:"customer_id"`
	Note            string         `gorm:"not null" json:"note"`
	CreatedByUserID string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (CustomerNote) TableName() string {
	return "customer_notes"
}
