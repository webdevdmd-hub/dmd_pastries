package charges

import "time"

type ChargeInput struct {
	ChargeType   string  `json:"charge_type"`
	ChargeName   string  `json:"charge_name"`
	Description  string  `json:"description"`
	Amount       float64 `json:"amount"`
	TaxRateID    string  `json:"tax_rate_id"`
	IsRefundable *bool   `json:"is_refundable"`
}

type ChargeRefundInput struct {
	SourceChargeID string  `json:"source_charge_id"`
	RefundAmount   float64 `json:"refund_amount"`
	Reason         string  `json:"reason"`
}

type ChargeResponse struct {
	ID                        string    `json:"id"`
	DocumentType              string    `json:"document_type"`
	DocumentID                string    `json:"document_id"`
	ChargeType                string    `json:"charge_type"`
	ChargeName                string    `json:"charge_name"`
	Description               string    `json:"description"`
	Amount                    float64   `json:"amount"`
	TaxRateID                 *string   `json:"tax_rate_id"`
	TaxRateNameSnapshot       string    `json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64   `json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64   `json:"tax_amount"`
	TotalAmount               float64   `json:"total_amount"`
	IsRefundable              bool      `json:"is_refundable"`
	SourceChargeID            *string   `json:"source_charge_id"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

type ChargeTotals struct {
	Amount    float64
	TaxAmount float64
	Total     float64
}
