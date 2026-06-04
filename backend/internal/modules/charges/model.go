package charges

import (
	"time"

	"gorm.io/gorm"
)

type DocumentCharge struct {
	ID                        string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID                string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                  string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	DocumentType              string         `gorm:"size:50;not null;index" json:"document_type"`
	DocumentID                string         `gorm:"type:uuid;not null;index" json:"document_id"`
	ChargeType                string         `gorm:"size:50;not null" json:"charge_type"`
	ChargeName                string         `gorm:"size:150;not null" json:"charge_name"`
	Description               string         `json:"description"`
	Amount                    float64        `gorm:"not null;default:0" json:"amount"`
	TaxRateID                 *string        `gorm:"type:uuid;index" json:"tax_rate_id"`
	TaxRateNameSnapshot       string         `gorm:"size:150" json:"tax_rate_name_snapshot"`
	TaxRatePercentageSnapshot float64        `gorm:"not null;default:0" json:"tax_rate_percentage_snapshot"`
	TaxAmount                 float64        `gorm:"not null;default:0" json:"tax_amount"`
	TotalAmount               float64        `gorm:"not null;default:0" json:"total_amount"`
	IsRefundable              bool           `gorm:"not null;default:true" json:"is_refundable"`
	SourceChargeID            *string        `gorm:"type:uuid;index" json:"source_charge_id"`
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (DocumentCharge) TableName() string {
	return "document_charges"
}
