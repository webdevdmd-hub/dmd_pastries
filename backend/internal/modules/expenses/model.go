package expenses

import (
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/money"
)

type Expense struct {
	ID                     string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID             string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID               string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ExpenseNumber          string         `gorm:"size:100;not null" json:"expense_number"`
	ExpenseDate            time.Time      `gorm:"type:date;not null" json:"expense_date"`
	ExpenseAccountID       string         `gorm:"type:uuid;not null;index" json:"expense_account_id"`
	PaidThroughAccountID   string         `gorm:"type:uuid;not null;index" json:"paid_through_account_id"`
	SupplierID             *string        `gorm:"type:uuid;index" json:"supplier_id"`
	CustomerID             *string        `gorm:"type:uuid;index" json:"customer_id"`
	Amount                 money.Amount   `gorm:"type:numeric(14,2);not null" json:"amount"`
	ReferenceNumber        string         `gorm:"size:255" json:"reference_number"`
	Notes                  string         `json:"notes"`
	ReceiptFileID          string         `gorm:"size:500" json:"receipt_file_id"`
	IsBillable             bool           `gorm:"not null;default:false" json:"is_billable"`
	Status                 string         `gorm:"size:50;not null;default:posted" json:"status"`
	JournalEntryID         *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	ReversalJournalEntryID *string        `gorm:"type:uuid;index" json:"reversal_journal_entry_id"`
	CreatedByUserID        string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID        *string        `gorm:"type:uuid;index" json:"updated_by_user_id"`
	VoidedByUserID         *string        `gorm:"type:uuid;index" json:"voided_by_user_id"`
	VoidedAt               *time.Time     `json:"voided_at"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (Expense) TableName() string { return "expenses" }
