package suppliers

import (
	"time"

	"gorm.io/gorm"
)

type Supplier struct {
	ID           string `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID     string `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierCode string `gorm:"size:100;not null" json:"supplier_code"`
	SupplierName string `gorm:"size:255;not null" json:"supplier_name"`
	Phone        string `gorm:"size:100" json:"phone"`
	Email        string `gorm:"size:255" json:"email"`
	Website      string `gorm:"size:255" json:"website"`
	AddressLine1 string `gorm:"column:address_line_1;size:255" json:"address_line_1"`
	AddressLine2 string `gorm:"column:address_line_2;size:255" json:"address_line_2"`
	City         string `gorm:"size:100" json:"city"`
	State        string `gorm:"size:100" json:"state"`
	Country      string `gorm:"size:100" json:"country"`
	PostalCode   string `gorm:"size:50" json:"postal_code"`
	TaxNumber    string `gorm:"size:100" json:"tax_number"`
	Notes        string `json:"notes"`
	Status       string `gorm:"size:50;not null;default:active" json:"status"`
	// How you buy from this supplier. Absent from the original schema, which
	// left a buyer with no in-app answer to "when does it arrive, when do I
	// pay" (migration 000109).
	PaymentTerms string `gorm:"size:20;not null;default:''" json:"payment_terms"`
	// Nullable on purpose: 0 means same-day, so it cannot double as "unknown".
	LeadTimeDays    *int           `gorm:"" json:"lead_time_days"`
	IsPreferred     bool           `gorm:"not null;default:false" json:"is_preferred"`
	CreatedByUserID string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID string         `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Supplier) TableName() string {
	return "suppliers"
}

type SupplierContact struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID  string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID    string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierID  string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	ContactName string         `gorm:"size:255;not null" json:"contact_name"`
	ContactRole string         `gorm:"size:150" json:"contact_role"`
	Phone       string         `gorm:"size:100" json:"phone"`
	Email       string         `gorm:"size:255" json:"email"`
	IsPrimary   bool           `gorm:"not null;default:false" json:"is_primary"`
	Notes       string         `json:"notes"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (SupplierContact) TableName() string {
	return "supplier_contacts"
}

type SupplierNote struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SupplierID      string         `gorm:"type:uuid;not null;index" json:"supplier_id"`
	Note            string         `gorm:"not null" json:"note"`
	CreatedByUserID string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (SupplierNote) TableName() string {
	return "supplier_notes"
}
