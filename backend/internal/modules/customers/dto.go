package customers

import "time"

type CreateCustomerRequest struct {
	FullName     string   `json:"full_name" binding:"required"`
	Phone        string   `json:"phone"`
	Email        string   `json:"email" binding:"omitempty,email"`
	DateOfBirth  string   `json:"date_of_birth"`
	Gender       string   `json:"gender"`
	AddressLine1 string   `json:"address_line_1"`
	AddressLine2 string   `json:"address_line_2"`
	City         string   `json:"city"`
	State        string   `json:"state"`
	Country      string   `json:"country"`
	PostalCode   string   `json:"postal_code"`
	Notes        string   `json:"notes"`
	TagIDs       []string `json:"tag_ids" binding:"omitempty,dive,uuid"`
}

type QuickCreateCustomerRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Phone    string `json:"phone"`
	Email    string `json:"email" binding:"omitempty,email"`
}

type UpdateCustomerRequest struct {
	FullName     string   `json:"full_name"`
	Phone        string   `json:"phone"`
	Email        string   `json:"email" binding:"omitempty,email"`
	DateOfBirth  string   `json:"date_of_birth"`
	Gender       string   `json:"gender"`
	AddressLine1 string   `json:"address_line_1"`
	AddressLine2 string   `json:"address_line_2"`
	City         string   `json:"city"`
	State        string   `json:"state"`
	Country      string   `json:"country"`
	PostalCode   string   `json:"postal_code"`
	Notes        string   `json:"notes"`
	TagIDs       []string `json:"tag_ids" binding:"omitempty,dive,uuid"`
}

type UpdateCustomerStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type CreateCustomerTagRequest struct {
	TagName string `json:"tag_name" binding:"required"`
	Color   string `json:"color"`
}

type UpdateCustomerTagRequest struct {
	TagName string `json:"tag_name"`
	Color   string `json:"color"`
}

type CreateCustomerNoteRequest struct {
	Note string `json:"note" binding:"required"`
}

type AssignCustomerTagRequest struct {
	TagID string `json:"tag_id" binding:"required,uuid"`
}

type CustomerListQuery struct {
	Search    string
	Phone     string
	Email     string
	Status    string
	TagID     string
	DateFrom  string
	DateTo    string
	Page      int
	Limit     int
	SortBy    string
	SortOrder string
}

type CustomerLookupQuery struct {
	Search string
	Phone  string
	Email  string
	Limit  int
}

type CustomerLookupResponse struct {
	Items []CustomerLookupItem `json:"items"`
}

type CustomerLookupItem struct {
	ID           string `json:"id"`
	CustomerCode string `json:"customer_code"`
	FullName     string `json:"full_name"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Status       string `json:"status"`
}

type CustomerListResponse struct {
	Items      []CustomerResponse `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type CustomerResponse struct {
	ID           string                `json:"id"`
	BusinessID   string                `json:"business_id"`
	BranchID     string                `json:"branch_id"`
	CustomerCode string                `json:"customer_code"`
	FullName     string                `json:"full_name"`
	Phone        string                `json:"phone"`
	Email        string                `json:"email"`
	DateOfBirth  *string               `json:"date_of_birth"`
	Gender       string                `json:"gender"`
	AddressLine1 string                `json:"address_line_1"`
	AddressLine2 string                `json:"address_line_2"`
	City         string                `json:"city"`
	State        string                `json:"state"`
	Country      string                `json:"country"`
	PostalCode   string                `json:"postal_code"`
	Notes        string                `json:"notes"`
	Status       string                `json:"status"`
	Tags         []CustomerTagResponse `json:"tags" gorm:"-"`
	Stats        *CustomerBasicStats   `json:"stats,omitempty" gorm:"-"`
	CreatedAt    time.Time             `json:"created_at"`
	UpdatedAt    time.Time             `json:"updated_at"`
}

type CustomerBasicStats struct {
	TotalOrdersCount int64      `json:"total_orders_count"`
	LastPurchaseAt   *time.Time `json:"last_purchase_at"`
	TotalSalesAmount float64    `json:"total_sales_amount"`
	NetSpent         float64    `json:"net_spent"`
}

type CustomerTagResponse struct {
	ID        string    `json:"id"`
	TagName   string    `json:"tag_name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CustomerNoteResponse struct {
	ID              string    `json:"id"`
	CustomerID      string    `json:"customer_id"`
	Note            string    `json:"note"`
	CreatedByUserID string    `json:"created_by_user_id"`
	CreatedByName   string    `json:"created_by_name"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CustomerStatsResponse struct {
	CustomerID          string                        `json:"customer_id"`
	TotalSalesAmount    float64                       `json:"total_sales_amount"`
	POSSalesAmount      float64                       `json:"pos_sales_amount"`
	POSSalesCount       int64                         `json:"pos_sales_count"`
	BakeryOrdersAmount  float64                       `json:"bakery_orders_amount"`
	BakeryOrdersCount   int64                         `json:"bakery_orders_count"`
	TotalPaidAmount     float64                       `json:"total_paid_amount"`
	TotalRefundedAmount float64                       `json:"total_refunded_amount"`
	NetSpent            float64                       `json:"net_spent"`
	TotalOrdersCount    int64                         `json:"total_orders_count"`
	LastPurchaseAt      *time.Time                    `json:"last_purchase_at"`
	LastOrderAt         *time.Time                    `json:"last_order_at"`
	OutstandingBalance  float64                       `json:"outstanding_balance"`
	PendingPayments     int64                         `json:"pending_payments"`
	RecentTransactions  []CustomerTransactionResponse `json:"recent_transactions"`
}

type CustomerTransactionResponse struct {
	ID            string    `json:"id"`
	SourceType    string    `json:"source_type"`
	SourceID      string    `json:"source_id"`
	SourceNumber  string    `json:"source_number"`
	Description   string    `json:"description"`
	Amount        float64   `json:"amount"`
	Status        string    `json:"status"`
	PaymentStatus string    `json:"payment_status"`
	OccurredAt    time.Time `json:"occurred_at"`
}
