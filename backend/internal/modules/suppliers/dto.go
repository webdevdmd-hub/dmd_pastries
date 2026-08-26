package suppliers

import (
	"time"

	"pastries-pos/internal/shared/money"
)

type SupplierListQuery struct {
	Search    string
	Status    string
	City      string
	Country   string
	DateFrom  string
	DateTo    string
	Page      int
	Limit     int
	SortBy    string
	SortOrder string
}

type SupplierLookupQuery struct {
	Search string
	Limit  int
}

type SupplierStatementQuery struct {
	DateFrom        string
	DateTo          string
	TransactionType string
}

type CreateSupplierRequest struct {
	SupplierName string `json:"supplier_name" binding:"required"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Website      string `json:"website"`
	AddressLine1 string `json:"address_line_1"`
	AddressLine2 string `json:"address_line_2"`
	City         string `json:"city"`
	State        string `json:"state"`
	Country      string `json:"country"`
	PostalCode   string `json:"postal_code"`
	TaxNumber    string `json:"tax_number"`
	Notes        string `json:"notes"`
	PaymentTerms string `json:"payment_terms"`
	LeadTimeDays *int   `json:"lead_time_days"`
	IsPreferred  *bool  `json:"is_preferred"`
}

type UpdateSupplierRequest struct {
	SupplierName string `json:"supplier_name"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Website      string `json:"website"`
	AddressLine1 string `json:"address_line_1"`
	AddressLine2 string `json:"address_line_2"`
	City         string `json:"city"`
	State        string `json:"state"`
	Country      string `json:"country"`
	PostalCode   string `json:"postal_code"`
	TaxNumber    string `json:"tax_number"`
	Notes        string `json:"notes"`
	PaymentTerms string `json:"payment_terms"`
	LeadTimeDays *int   `json:"lead_time_days"`
	IsPreferred  *bool  `json:"is_preferred"`
}

type UpdateSupplierStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type CreateSupplierContactRequest struct {
	ContactName string `json:"contact_name" binding:"required"`
	ContactRole string `json:"contact_role"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	IsPrimary   bool   `json:"is_primary"`
	Notes       string `json:"notes"`
}

type UpdateSupplierContactRequest struct {
	ContactName string `json:"contact_name"`
	ContactRole string `json:"contact_role"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	IsPrimary   *bool  `json:"is_primary"`
	Notes       string `json:"notes"`
}

type CreateSupplierNoteRequest struct {
	Note string `json:"note" binding:"required"`
}

type SupplierResponse struct {
	ID             string                   `json:"id"`
	BusinessID     string                   `json:"business_id"`
	BranchID       string                   `json:"branch_id"`
	SupplierCode   string                   `json:"supplier_code"`
	SupplierName   string                   `json:"supplier_name"`
	Phone          string                   `json:"phone"`
	Email          string                   `json:"email"`
	Website        string                   `json:"website"`
	AddressLine1   string                   `json:"address_line_1"`
	AddressLine2   string                   `json:"address_line_2"`
	City           string                   `json:"city"`
	State          string                   `json:"state"`
	Country        string                   `json:"country"`
	PostalCode     string                   `json:"postal_code"`
	TaxNumber      string                   `json:"tax_number"`
	Notes          string                   `json:"notes"`
	Status         string                   `json:"status"`
	PaymentTerms   string                   `json:"payment_terms"`
	LeadTimeDays   *int                     `json:"lead_time_days"`
	IsPreferred    bool                     `json:"is_preferred"`
	PrimaryContact *SupplierContactResponse `json:"primary_contact"`
	CreatedAt      time.Time                `json:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at"`
}

type SupplierContactResponse struct {
	ID          string    `json:"id"`
	SupplierID  string    `json:"supplier_id"`
	ContactName string    `json:"contact_name"`
	ContactRole string    `json:"contact_role"`
	Phone       string    `json:"phone"`
	Email       string    `json:"email"`
	IsPrimary   bool      `json:"is_primary"`
	Notes       string    `json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SupplierNoteResponse struct {
	ID              string    `json:"id"`
	SupplierID      string    `json:"supplier_id"`
	Note            string    `json:"note"`
	CreatedByUserID string    `json:"created_by_user_id"`
	CreatedByName   string    `json:"created_by_name"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type SupplierLookupItem struct {
	ID           string `json:"id"`
	SupplierCode string `json:"supplier_code"`
	SupplierName string `json:"supplier_name"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Status       string `json:"status"`
}

type SupplierLookupResponse struct {
	Items []SupplierLookupItem `json:"items"`
}

type SupplierListResponse struct {
	Items      []SupplierResponse `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type SupplierStatementResponse struct {
	SupplierID     string                          `json:"supplier_id"`
	SupplierCode   string                          `json:"supplier_code"`
	SupplierName   string                          `json:"supplier_name"`
	DateFrom       string                          `json:"date_from"`
	DateTo         string                          `json:"date_to"`
	OpeningBalance money.Amount                    `json:"opening_balance"`
	TotalDebit     money.Amount                    `json:"total_debit"`
	TotalCredit    money.Amount                    `json:"total_credit"`
	ClosingBalance money.Amount                    `json:"closing_balance"`
	Items          []SupplierStatementItemResponse `json:"items"`
}

type SupplierStatementItemResponse struct {
	ID                string       `json:"id"`
	DocumentID        string       `json:"document_id"`
	DocumentNumber    string       `json:"document_number"`
	TransactionType   string       `json:"transaction_type"`
	TransactionDate   time.Time    `json:"transaction_date"`
	BranchID          string       `json:"branch_id"`
	BranchName        string       `json:"branch_name"`
	DebitAmount       money.Amount `json:"debit_amount"`
	CreditAmount      money.Amount `json:"credit_amount"`
	RunningBalance    money.Amount `json:"running_balance"`
	Status            string       `json:"status"`
	PaymentStatus     string       `json:"payment_status"`
	ReferenceNumber   string       `json:"reference_number"`
	Notes             string       `json:"notes"`
	PurchaseOrderID   *string      `json:"purchase_order_id,omitempty"`
	PurchaseInvoiceID *string      `json:"purchase_invoice_id,omitempty"`
	PurchaseReceiptID *string      `json:"purchase_receipt_id,omitempty"`
	PurchaseReturnID  *string      `json:"purchase_return_id,omitempty"`
	PaymentID         *string      `json:"payment_id,omitempty"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type SupplierStatsResponse struct {
	SupplierID          string       `json:"supplier_id"`
	TotalPurchaseOrders int64        `json:"total_purchase_orders"`
	TotalBills          int64        `json:"total_bills"`
	TotalPurchaseAmount money.Amount `json:"total_purchase_amount"`
	TotalPaidAmount     money.Amount `json:"total_paid_amount"`
	LastPurchaseDate    *string      `json:"last_purchase_date"`
	OutstandingBalance  money.Amount `json:"outstanding_balance"`
	OutstandingPayables money.Amount `json:"outstanding_payables"`
}
