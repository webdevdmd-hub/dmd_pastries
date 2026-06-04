package salesreturns

import (
	"time"

	"pastries-pos/internal/modules/charges"
)

type SalesReturnListQuery struct {
	Search     string
	SaleID     string
	BranchID   string
	CustomerID string
	Status     string
	DateFrom   string
	DateTo     string
	Page       int
	Limit      int
	SortOrder  string
}

type SalesReturnItemRequest struct {
	SaleItemID      string  `json:"sale_item_id" binding:"required,uuid"`
	Quantity        float64 `json:"quantity" binding:"required"`
	RestockAction   string  `json:"restock_action" binding:"required"`
	StockLocationID *string `json:"stock_location_id" binding:"omitempty,uuid"`
	Reason          string  `json:"reason"`
}

type CreateSalesReturnRequest struct {
	SaleID                string                      `json:"sale_id" binding:"required,uuid"`
	ReturnDate            string                      `json:"return_date" binding:"required"`
	Reason                string                      `json:"reason"`
	RefundMode            string                      `json:"refund_mode" binding:"required"`
	RefundPaymentMethodID *string                     `json:"refund_payment_method_id" binding:"omitempty,uuid"`
	RefundReferenceNumber string                      `json:"refund_reference_number"`
	Items                 []SalesReturnItemRequest    `json:"items" binding:"required"`
	RefundCharges         []charges.ChargeRefundInput `json:"refund_charges"`
}

type UpdateSalesReturnRequest struct {
	ReturnDate            string                      `json:"return_date" binding:"required"`
	Reason                string                      `json:"reason"`
	RefundMode            string                      `json:"refund_mode" binding:"required"`
	RefundPaymentMethodID *string                     `json:"refund_payment_method_id" binding:"omitempty,uuid"`
	RefundReferenceNumber string                      `json:"refund_reference_number"`
	Items                 []SalesReturnItemRequest    `json:"items" binding:"required"`
	RefundCharges         []charges.ChargeRefundInput `json:"refund_charges"`
}

type SalesReturnResponse struct {
	ID                      string                    `json:"id"`
	BusinessID              string                    `json:"business_id"`
	BranchID                string                    `json:"branch_id"`
	BranchName              string                    `json:"branch_name"`
	SaleID                  string                    `json:"sale_id"`
	SaleNumber              string                    `json:"sale_number"`
	CustomerID              *string                   `json:"customer_id"`
	CustomerName            string                    `json:"customer_name"`
	ReturnNumber            string                    `json:"return_number"`
	ReturnDate              string                    `json:"return_date"`
	Reason                  string                    `json:"reason"`
	Status                  string                    `json:"status"`
	SubtotalAmount          float64                   `json:"subtotal_amount"`
	TaxAmount               float64                   `json:"tax_amount"`
	ChargeAmount            float64                   `json:"charge_amount"`
	ChargeTaxAmount         float64                   `json:"charge_tax_amount"`
	ReturnTotal             float64                   `json:"return_total"`
	RefundMode              string                    `json:"refund_mode"`
	RefundPaymentMethodID   *string                   `json:"refund_payment_method_id"`
	RefundPaymentMethodName string                    `json:"refund_payment_method_name"`
	RefundAmount            float64                   `json:"refund_amount"`
	RefundReferenceNumber   string                    `json:"refund_reference_number"`
	PaymentRefundID         *string                   `json:"payment_refund_id"`
	PaymentRefundNumber     string                    `json:"payment_refund_number"`
	JournalEntryID          *string                   `json:"journal_entry_id"`
	JournalEntryNumber      string                    `json:"journal_entry_number"`
	ApprovedByUserID        *string                   `json:"approved_by_user_id"`
	CreatedByUserID         string                    `json:"created_by_user_id"`
	CreatedByUserName       string                    `json:"created_by_user_name"`
	PostedByUserID          *string                   `json:"posted_by_user_id"`
	PostedAt                *time.Time                `json:"posted_at"`
	CancelledByUserID       *string                   `json:"cancelled_by_user_id"`
	CancelledAt             *time.Time                `json:"cancelled_at"`
	Items                   []SalesReturnItemResponse `json:"items"`
	Charges                 []charges.ChargeResponse  `json:"charges"`
	CreatedAt               time.Time                 `json:"created_at"`
	UpdatedAt               time.Time                 `json:"updated_at"`
}

type SalesReturnItemResponse struct {
	ID                        string  `json:"id"`
	SalesReturnID             string  `json:"sales_return_id"`
	SaleItemID                string  `json:"sale_item_id"`
	ProductID                 string  `json:"product_id"`
	ProductVariantID          *string `json:"product_variant_id"`
	ProductNameSnapshot       string  `json:"product_name_snapshot"`
	VariantNameSnapshot       string  `json:"variant_name_snapshot"`
	SKUSnapshot               string  `json:"sku_snapshot"`
	ItemNameSnapshot          string  `json:"item_name_snapshot"`
	Quantity                  float64 `json:"quantity"`
	UnitPrice                 float64 `json:"unit_price"`
	DiscountAmount            float64 `json:"discount_amount"`
	TaxRateID                 *string `json:"tax_rate_id"`
	TaxRateNameSnapshot       string  `json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64 `json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64 `json:"tax_amount"`
	LineSubtotal              float64 `json:"line_subtotal"`
	LineTotal                 float64 `json:"line_total"`
	RestockAction             string  `json:"restock_action"`
	StockLocationID           *string `json:"stock_location_id"`
	StockLocationName         string  `json:"stock_location_name"`
	StockMovementID           *string `json:"stock_movement_id"`
	Reason                    string  `json:"reason"`
}

type ReturnableItemResponse struct {
	SaleItemID                string  `json:"sale_item_id"`
	ProductID                 string  `json:"product_id"`
	ProductVariantID          *string `json:"product_variant_id"`
	ProductNameSnapshot       string  `json:"product_name_snapshot"`
	VariantNameSnapshot       string  `json:"variant_name_snapshot"`
	ItemNameSnapshot          string  `json:"item_name_snapshot"`
	SKUSnapshot               string  `json:"sku_snapshot"`
	SoldQuantity              float64 `json:"sold_quantity"`
	AlreadyReturnedQuantity   float64 `json:"already_returned_quantity"`
	ReturnableQuantity        float64 `json:"returnable_quantity"`
	UnitPrice                 float64 `json:"unit_price"`
	DiscountAmount            float64 `json:"discount_amount"`
	TaxRateID                 *string `json:"tax_rate_id"`
	TaxRateNameSnapshot       string  `json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64 `json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64 `json:"tax_amount"`
	LineSubtotal              float64 `json:"line_subtotal"`
	LineTotal                 float64 `json:"line_total"`
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
