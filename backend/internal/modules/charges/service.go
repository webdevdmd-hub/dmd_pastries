package charges

import (
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type taxRateRow struct {
	ID             string
	TaxName        string
	RatePercentage float64
	IsInclusive    bool
}

// BuildCharges keeps the legacy per-rate tax behavior; document types that
// carry a tax_mode use BuildChargesWithMode so charges follow the document
// (Phase 4 / W3).
func BuildCharges(tx *gorm.DB, businessID, branchID, documentType, documentID string, inputs []ChargeInput) ([]DocumentCharge, ChargeTotals, error) {
	return BuildChargesWithMode(tx, businessID, branchID, documentType, documentID, inputs, TaxModePerRate)
}

func BuildChargesWithMode(tx *gorm.DB, businessID, branchID, documentType, documentID string, inputs []ChargeInput, taxMode string) ([]DocumentCharge, ChargeTotals, error) {
	if len(inputs) == 0 {
		return nil, ChargeTotals{}, nil
	}
	if !ValidDocumentType(documentType) {
		return nil, ChargeTotals{}, apperrors.BadRequest("invalid charge document_type", map[string]interface{}{"document_type": documentType})
	}
	charges := make([]DocumentCharge, 0, len(inputs))
	totals := ChargeTotals{}
	for _, input := range inputs {
		chargeType := strings.TrimSpace(input.ChargeType)
		if chargeType == "" {
			chargeType = "other"
		}
		if !ValidChargeType(chargeType) {
			return nil, ChargeTotals{}, apperrors.BadRequest("invalid charge_type", map[string]interface{}{"charge_type": chargeType})
		}
		if input.Amount < 0 {
			return nil, ChargeTotals{}, apperrors.BadRequest("charge amount must be non-negative", nil)
		}
		amount := roundMoney(input.Amount)
		chargeName := strings.TrimSpace(input.ChargeName)
		if chargeName == "" {
			chargeName = defaultChargeName(chargeType)
		}
		isRefundable := true
		if input.IsRefundable != nil {
			isRefundable = *input.IsRefundable
		}
		var taxID *string
		var taxName string
		var taxPercentage float64
		var taxAmount float64
		total := amount
		if strings.TrimSpace(input.TaxRateID) != "" && taxMode != TaxModeNoTax {
			tax, err := loadTaxRate(tx, businessID, strings.TrimSpace(input.TaxRateID))
			if err != nil {
				if err == gorm.ErrRecordNotFound {
					return nil, ChargeTotals{}, apperrors.BadRequest("invalid charge tax_rate_id", nil)
				}
				return nil, ChargeTotals{}, apperrors.Internal("failed to validate charge tax rate")
			}
			taxID = &tax.ID
			taxName = tax.TaxName
			taxPercentage = tax.RatePercentage
			taxAmount, total = ResolveLineTax(amount, tax.RatePercentage, tax.IsInclusive, taxMode)
		}
		charge := DocumentCharge{
			ID:                        utils.NewUUID(),
			BusinessID:                businessID,
			BranchID:                  branchID,
			DocumentType:              documentType,
			DocumentID:                documentID,
			ChargeType:                chargeType,
			ChargeName:                chargeName,
			Description:               strings.TrimSpace(input.Description),
			Amount:                    amount,
			TaxRateID:                 taxID,
			TaxRateNameSnapshot:       taxName,
			TaxRatePercentageSnapshot: taxPercentage,
			TaxAmount:                 taxAmount,
			TotalAmount:               total,
			IsRefundable:              isRefundable,
		}
		charges = append(charges, charge)
		totals.Amount = roundMoney(totals.Amount + charge.Amount)
		totals.TaxAmount = roundMoney(totals.TaxAmount + charge.TaxAmount)
		totals.Total = roundMoney(totals.Total + charge.TotalAmount)
	}
	return charges, totals, nil
}

func ReplaceCharges(tx *gorm.DB, businessID, branchID, documentType, documentID string, inputs []ChargeInput) (ChargeTotals, error) {
	return ReplaceChargesWithMode(tx, businessID, branchID, documentType, documentID, inputs, TaxModePerRate)
}

func ReplaceChargesWithMode(tx *gorm.DB, businessID, branchID, documentType, documentID string, inputs []ChargeInput, taxMode string) (ChargeTotals, error) {
	if err := tx.Model(&DocumentCharge{}).
		Where("business_id = ? AND document_type = ? AND document_id = ? AND deleted_at IS NULL", businessID, documentType, documentID).
		Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
		return ChargeTotals{}, err
	}
	rows, totals, err := BuildChargesWithMode(tx, businessID, branchID, documentType, documentID, inputs, taxMode)
	if err != nil {
		return ChargeTotals{}, err
	}
	if len(rows) > 0 {
		if err := tx.Create(&rows).Error; err != nil {
			return ChargeTotals{}, err
		}
	}
	return totals, nil
}

func CopyCharges(tx *gorm.DB, businessID, branchID, fromType, fromID, toType, toID string) (ChargeTotals, error) {
	source, err := ListChargeRows(tx, businessID, fromType, fromID)
	if err != nil {
		return ChargeTotals{}, err
	}
	now := time.Now().UTC()
	copied := make([]DocumentCharge, 0, len(source))
	totals := ChargeTotals{}
	for _, row := range source {
		sourceID := row.ID
		row.ID = utils.NewUUID()
		row.BranchID = branchID
		row.DocumentType = toType
		row.DocumentID = toID
		row.SourceChargeID = &sourceID
		row.CreatedAt = now
		row.UpdatedAt = now
		row.DeletedAt = gorm.DeletedAt{}
		copied = append(copied, row)
		totals.Amount = roundMoney(totals.Amount + row.Amount)
		totals.TaxAmount = roundMoney(totals.TaxAmount + row.TaxAmount)
		totals.Total = roundMoney(totals.Total + row.TotalAmount)
	}
	if len(copied) > 0 {
		if err := tx.Create(&copied).Error; err != nil {
			return ChargeTotals{}, err
		}
	}
	return totals, nil
}

func ListChargeRows(tx *gorm.DB, businessID, documentType, documentID string) ([]DocumentCharge, error) {
	var rows []DocumentCharge
	err := tx.Where("business_id = ? AND document_type = ? AND document_id = ? AND deleted_at IS NULL", businessID, documentType, documentID).
		Order("created_at ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func ListChargeResponses(tx *gorm.DB, businessID, documentType, documentID string) ([]ChargeResponse, error) {
	rows, err := ListChargeRows(tx, businessID, documentType, documentID)
	if err != nil {
		return nil, err
	}
	out := make([]ChargeResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, ToResponse(row))
	}
	return out, nil
}

func SumCharges(tx *gorm.DB, businessID, documentType, documentID string) (ChargeTotals, error) {
	var totals ChargeTotals
	err := tx.Table("document_charges").
		Select("COALESCE(SUM(amount),0) AS amount, COALESCE(SUM(tax_amount),0) AS tax_amount, COALESCE(SUM(total_amount),0) AS total").
		Where("business_id = ? AND document_type = ? AND document_id = ? AND deleted_at IS NULL", businessID, documentType, documentID).
		Scan(&totals).Error
	totals.Amount = roundMoney(totals.Amount)
	totals.TaxAmount = roundMoney(totals.TaxAmount)
	totals.Total = roundMoney(totals.Total)
	return totals, err
}

func ToResponse(row DocumentCharge) ChargeResponse {
	return ChargeResponse{
		ID:                        row.ID,
		DocumentType:              row.DocumentType,
		DocumentID:                row.DocumentID,
		ChargeType:                row.ChargeType,
		ChargeName:                row.ChargeName,
		Description:               row.Description,
		Amount:                    roundMoney(row.Amount),
		TaxRateID:                 row.TaxRateID,
		TaxRateNameSnapshot:       row.TaxRateNameSnapshot,
		TaxRatePercentageSnapshot: row.TaxRatePercentageSnapshot,
		TaxAmount:                 roundMoney(row.TaxAmount),
		TotalAmount:               roundMoney(row.TotalAmount),
		IsRefundable:              row.IsRefundable,
		SourceChargeID:            row.SourceChargeID,
		CreatedAt:                 row.CreatedAt,
		UpdatedAt:                 row.UpdatedAt,
	}
}

func ValidDocumentType(value string) bool {
	switch value {
	case "pos_sale", "held_sale", "bakery_order", "purchase_order", "purchase_invoice", "purchase_receipt", "sales_return", "purchase_return":
		return true
	default:
		return false
	}
}

func ValidChargeType(value string) bool {
	switch value {
	case "delivery", "service", "packing", "platform", "freight", "handling", "other":
		return true
	default:
		return false
	}
}

func defaultChargeName(chargeType string) string {
	switch chargeType {
	case "delivery":
		return "Delivery Charge"
	case "service":
		return "Service Charge"
	case "packing":
		return "Packing Charge"
	case "platform":
		return "Platform Charge"
	case "freight":
		return "Freight / Carriage"
	case "handling":
		return "Handling Charge"
	default:
		return "Other Charge"
	}
}

func loadTaxRate(tx *gorm.DB, businessID, taxRateID string) (*taxRateRow, error) {
	var tax taxRateRow
	err := tx.Table("tax_rates").
		Select("id, tax_name, rate_percentage, is_inclusive").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", taxRateID, businessID, "active").
		Take(&tax).Error
	return &tax, err
}

func calculateTax(amount, rate float64, inclusive bool) float64 {
	if amount <= 0 || rate <= 0 {
		return 0
	}
	if inclusive {
		return roundMoney(amount - (amount / (1 + rate/100)))
	}
	return roundMoney(amount * rate / 100)
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
