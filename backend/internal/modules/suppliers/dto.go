package suppliers

import "time"

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

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type SupplierStatsResponse struct {
	SupplierID          string  `json:"supplier_id"`
	TotalPurchaseOrders int64   `json:"total_purchase_orders"`
	TotalPurchaseAmount float64 `json:"total_purchase_amount"`
	LastPurchaseDate    *string `json:"last_purchase_date"`
	OutstandingPayables float64 `json:"outstanding_payables"`
}
