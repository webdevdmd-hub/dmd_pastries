package payments

import (
	"time"

	"gorm.io/gorm"
)

type SalePayment struct {
	ID                        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                  string         `gorm:"type:uuid;index" json:"branch_id"`
	SaleID                    string         `gorm:"type:uuid;not null;index" json:"sale_id"`
	PaymentMethodID           string         `gorm:"type:uuid;not null;index" json:"payment_method_id"`
	PaymentMethodNameSnapshot string         `gorm:"size:150;not null" json:"payment_method_name_snapshot"`
	PaymentMethodTypeSnapshot string         `gorm:"size:50" json:"payment_method_type_snapshot"`
	Amount                    float64        `gorm:"not null" json:"amount"`
	ReferenceNumber           string         `gorm:"size:255" json:"reference_number"`
	ProviderTransactionID     string         `gorm:"size:255" json:"provider_transaction_id"`
	PaymentStatus             string         `gorm:"size:50;not null;default:completed" json:"payment_status"`
	PaidByUserID              string         `gorm:"type:uuid;index" json:"paid_by_user_id"`
	Notes                     string         `json:"notes"`
	PaidAt                    time.Time      `gorm:"not null" json:"paid_at"`
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (SalePayment) TableName() string {
	return "sale_payments"
}

type PaymentRefund struct {
	ID                        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                  string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	SaleID                    string         `gorm:"type:uuid;not null;index" json:"sale_id"`
	SalePaymentID             *string        `gorm:"type:uuid;index" json:"sale_payment_id"`
	RefundNumber              string         `gorm:"size:100;not null" json:"refund_number"`
	PaymentMethodID           string         `gorm:"type:uuid;not null;index" json:"payment_method_id"`
	PaymentMethodNameSnapshot string         `gorm:"size:150;not null" json:"payment_method_name_snapshot"`
	RefundAmount              float64        `gorm:"not null" json:"refund_amount"`
	RefundReason              string         `gorm:"not null" json:"refund_reason"`
	RefundStatus              string         `gorm:"size:50;not null;default:completed" json:"refund_status"`
	ApprovedByUserID          *string        `gorm:"type:uuid;index" json:"approved_by_user_id"`
	CreatedByUserID           string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	RefundedAt                time.Time      `gorm:"not null" json:"refunded_at"`
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PaymentRefund) TableName() string {
	return "payment_refunds"
}

type PaymentReconciliation struct {
	ID                 string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID         string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID           string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ReconciliationDate time.Time      `gorm:"type:date;not null" json:"reconciliation_date"`
	PaymentMethodID    string         `gorm:"type:uuid;not null;index" json:"payment_method_id"`
	ExpectedAmount     float64        `gorm:"not null;default:0" json:"expected_amount"`
	CountedAmount      float64        `gorm:"not null;default:0" json:"counted_amount"`
	DifferenceAmount   float64        `gorm:"not null;default:0" json:"difference_amount"`
	Status             string         `gorm:"size:50;not null;default:submitted" json:"status"`
	CreatedByUserID    string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	Notes              string         `json:"notes"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PaymentReconciliation) TableName() string {
	return "payment_reconciliations"
}
