package expenses

import (
	"time"

	"pastries-pos/internal/shared/money"
)

type ExpenseListQuery struct {
	BranchID             string
	ExpenseAccountID     string
	PaidThroughAccountID string
	SupplierID           string
	CustomerID           string
	Status               string
	DateFrom             string
	DateTo               string
	Search               string
	Page                 int
	Limit                int
	SortBy               string
	SortOrder            string
}

type CreateExpenseRequest struct {
	BranchID             string       `json:"branch_id"`
	ExpenseDate          string       `json:"expense_date" binding:"required"`
	ExpenseAccountID     string       `json:"expense_account_id" binding:"required"`
	PaidThroughAccountID string       `json:"paid_through_account_id" binding:"required"`
	SupplierID           *string      `json:"supplier_id"`
	CustomerID           *string      `json:"customer_id"`
	Amount               money.Amount `json:"amount"`
	ReferenceNumber      string       `json:"reference_number"`
	Notes                string       `json:"notes"`
	ReceiptFileID        string       `json:"receipt_file_id"`
	IsBillable           bool         `json:"is_billable"`
}

type UpdateExpenseRequest struct {
	BranchID             *string       `json:"branch_id"`
	ExpenseDate          *string       `json:"expense_date"`
	ExpenseAccountID     *string       `json:"expense_account_id"`
	PaidThroughAccountID *string       `json:"paid_through_account_id"`
	SupplierID           *string       `json:"supplier_id"`
	CustomerID           *string       `json:"customer_id"`
	Amount               *money.Amount `json:"amount"`
	ReferenceNumber      *string       `json:"reference_number"`
	Notes                *string       `json:"notes"`
	ReceiptFileID        *string       `json:"receipt_file_id"`
	IsBillable           *bool         `json:"is_billable"`
}

type ExpenseResponse struct {
	ID                     string       `json:"id"`
	BusinessID             string       `json:"business_id"`
	BranchID               string       `json:"branch_id"`
	BranchName             string       `json:"branch_name"`
	ExpenseNumber          string       `json:"expense_number"`
	ExpenseDate            string       `json:"expense_date"`
	ExpenseAccountID       string       `json:"expense_account_id"`
	ExpenseAccountCode     string       `json:"expense_account_code"`
	ExpenseAccountName     string       `json:"expense_account_name"`
	PaidThroughAccountID   string       `json:"paid_through_account_id"`
	PaidThroughAccountCode string       `json:"paid_through_account_code"`
	PaidThroughAccountName string       `json:"paid_through_account_name"`
	SupplierID             *string      `json:"supplier_id"`
	SupplierName           string       `json:"supplier_name"`
	CustomerID             *string      `json:"customer_id"`
	CustomerName           string       `json:"customer_name"`
	Amount                 money.Amount `json:"amount"`
	ReferenceNumber        string       `json:"reference_number"`
	Notes                  string       `json:"notes"`
	ReceiptFileID          string       `json:"receipt_file_id"`
	IsBillable             bool         `json:"is_billable"`
	Status                 string       `json:"status"`
	JournalEntryID         *string      `json:"journal_entry_id"`
	ReversalJournalEntryID *string      `json:"reversal_journal_entry_id"`
	CreatedByUserID        string       `json:"created_by_user_id"`
	CreatedByUserName      string       `json:"created_by_user_name"`
	UpdatedByUserID        *string      `json:"updated_by_user_id"`
	VoidedByUserID         *string      `json:"voided_by_user_id"`
	VoidedAt               *time.Time   `json:"voided_at"`
	CreatedAt              time.Time    `json:"created_at"`
	UpdatedAt              time.Time    `json:"updated_at"`
}

type ExpenseListResponse struct {
	Items      []ExpenseResponse `json:"items"`
	Pagination Pagination        `json:"pagination"`
}

type Pagination struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}
