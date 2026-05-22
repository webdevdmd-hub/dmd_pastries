package payments

import "time"

type AddPaymentRequest struct {
	PaymentMethodID       string  `json:"payment_method_id" binding:"required,uuid"`
	Amount                float64 `json:"amount" binding:"required"`
	ReferenceNumber       string  `json:"reference_number"`
	ProviderTransactionID string  `json:"provider_transaction_id"`
	Notes                 string  `json:"notes"`
}

type RefundPaymentRequest struct {
	RefundAmount     float64 `json:"refund_amount" binding:"required"`
	RefundReason     string  `json:"refund_reason" binding:"required"`
	ApprovedByUserID *string `json:"approved_by_user_id" binding:"omitempty,uuid"`
}

type CreateReconciliationRequest struct {
	BranchID           string  `json:"branch_id" binding:"required,uuid"`
	ReconciliationDate string  `json:"reconciliation_date" binding:"required"`
	PaymentMethodID    string  `json:"payment_method_id" binding:"required,uuid"`
	CountedAmount      float64 `json:"counted_amount"`
	Notes              string  `json:"notes"`
	Status             string  `json:"status"`
}

type PaymentListQuery struct {
	Search          string
	SaleID          string
	BakeryOrderID   string
	SourceType      string
	SourceID        string
	PaymentMethodID string
	PaymentStatus   string
	BranchID        string
	PaidByUserID    string
	DateFrom        string
	DateTo          string
	Page            int
	Limit           int
	SortBy          string
	SortOrder       string
}

type RefundListQuery struct {
	SaleID          string
	PaymentMethodID string
	RefundStatus    string
	BranchID        string
	DateFrom        string
	DateTo          string
	Page            int
	Limit           int
}

type ReconciliationListQuery struct {
	BranchID        string
	PaymentMethodID string
	DateFrom        string
	DateTo          string
	Status          string
	Page            int
	Limit           int
}

type PaginatedResponse[T any] struct {
	Items      []T                `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type PaymentResponse struct {
	ID                        string                  `json:"id"`
	PaymentID                 string                  `json:"payment_id"`
	BusinessID                string                  `json:"business_id"`
	BranchID                  string                  `json:"branch_id"`
	BranchName                string                  `json:"branch_name"`
	SaleID                    string                  `json:"sale_id"`
	SaleNumber                string                  `json:"sale_number"`
	SourceType                string                  `json:"source_type"`
	SourceID                  string                  `json:"source_id"`
	SourceNumber              string                  `json:"source_number"`
	CustomerName              string                  `json:"customer_name"`
	PaymentMethodID           string                  `json:"payment_method_id"`
	PaymentMethodNameSnapshot string                  `json:"payment_method_name_snapshot"`
	PaymentMethodTypeSnapshot string                  `json:"payment_method_type_snapshot"`
	PaymentMethodName         string                  `json:"payment_method_name"`
	PaymentMethodType         string                  `json:"payment_method_type"`
	Amount                    float64                 `json:"amount"`
	ReferenceNumber           string                  `json:"reference_number"`
	ProviderTransactionID     string                  `json:"provider_transaction_id"`
	PaymentStatus             string                  `json:"payment_status"`
	PaymentType               *string                 `json:"payment_type"`
	PaidByUserID              string                  `json:"paid_by_user_id"`
	PaidByUserName            string                  `json:"paid_by_user_name"`
	Notes                     string                  `json:"notes"`
	PaidAt                    time.Time               `json:"paid_at"`
	CreatedAt                 time.Time               `json:"created_at"`
	UpdatedAt                 time.Time               `json:"updated_at"`
	Refunds                   []PaymentRefundResponse `json:"refunds,omitempty" gorm:"-"`
}

type SalePaymentsResponse struct {
	SaleID                    string            `json:"sale_id"`
	SaleNumber                string            `json:"sale_number"`
	TotalAmount               float64           `json:"total_amount"`
	TotalPaid                 float64           `json:"total_paid"`
	TotalRefunded             float64           `json:"total_refunded"`
	RemainingBalance          float64           `json:"remaining_balance"`
	RemainingRefundableAmount float64           `json:"remaining_refundable_amount"`
	Payments                  []PaymentResponse `json:"payments"`
}

type PaymentRefundResponse struct {
	ID                        string    `json:"id"`
	BusinessID                string    `json:"business_id"`
	BranchID                  string    `json:"branch_id"`
	SaleID                    string    `json:"sale_id"`
	SalePaymentID             *string   `json:"sale_payment_id"`
	RefundNumber              string    `json:"refund_number"`
	PaymentMethodID           string    `json:"payment_method_id"`
	PaymentMethodNameSnapshot string    `json:"payment_method_name_snapshot"`
	RefundAmount              float64   `json:"refund_amount"`
	RefundReason              string    `json:"refund_reason"`
	RefundStatus              string    `json:"refund_status"`
	ApprovedByUserID          *string   `json:"approved_by_user_id"`
	CreatedByUserID           string    `json:"created_by_user_id"`
	RefundedAt                time.Time `json:"refunded_at"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

type PaymentSummaryByMethod struct {
	PaymentMethodID   string  `json:"payment_method_id"`
	PaymentMethodName string  `json:"payment_method_name"`
	PaymentMethodType string  `json:"payment_method_type"`
	TotalAmount       float64 `json:"total_amount,omitempty"`
	CollectedAmount   float64 `json:"collected_amount"`
	RefundAmount      float64 `json:"refund_amount,omitempty"`
	RefundedAmount    float64 `json:"refunded_amount"`
	NetAmount         float64 `json:"net_amount"`
	Count             int64   `json:"-"`
	TransactionCount  int64   `json:"transaction_count,omitempty"`
}

type DailySummaryResponse struct {
	Date           string                   `json:"date"`
	BranchID       string                   `json:"branch_id"`
	TotalCollected float64                  `json:"total_collected"`
	TotalRefunded  float64                  `json:"total_refunded"`
	NetCollected   float64                  `json:"net_collected"`
	PaymentsCount  int64                    `json:"payments_count"`
	RefundsCount   int64                    `json:"refunds_count"`
	ByMethod       []PaymentSummaryByMethod `json:"by_method"`
}

type ReconciliationResponse struct {
	ID                 string    `json:"id"`
	BusinessID         string    `json:"business_id"`
	BranchID           string    `json:"branch_id"`
	ReconciliationDate string    `json:"reconciliation_date"`
	PaymentMethodID    string    `json:"payment_method_id"`
	ExpectedAmount     float64   `json:"expected_amount"`
	CountedAmount      float64   `json:"counted_amount"`
	DifferenceAmount   float64   `json:"difference_amount"`
	Status             string    `json:"status"`
	CreatedByUserID    string    `json:"created_by_user_id"`
	Notes              string    `json:"notes"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}
