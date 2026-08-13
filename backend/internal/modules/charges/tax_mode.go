package charges

// Phase 4 / W3 — per-document VAT modes.
//
// Historically, inclusiveness was a property of the tax RATE
// (tax_rates.is_inclusive). W3 makes it a property of the DOCUMENT: POS
// sales, bakery orders, and purchase bills carry a tax_mode that decides how
// every line's rate is applied. This file is the single definition of the
// mode semantics; the charges package hosts it because every selling and
// buying module already imports it.

import "gorm.io/gorm"

const (
	TaxModeInclusive = "inclusive"
	TaxModeExclusive = "exclusive"
	TaxModeNoTax     = "no_tax"
	// TaxModePerRate is the legacy sentinel (empty string): each line's tax
	// rate keeps its own is_inclusive behavior. Used by document types that
	// have no mode of their own (purchase orders, receipts, returns).
	TaxModePerRate = ""
)

// ValidTaxMode reports whether the value is one of the three explicit
// document modes.
func ValidTaxMode(value string) bool {
	switch value {
	case TaxModeInclusive, TaxModeExclusive, TaxModeNoTax:
		return true
	default:
		return false
	}
}

// ResolveLineTax applies a document tax mode to one line:
//
//	inclusive → tax extracted from amount, total = amount
//	exclusive → tax added on top,        total = amount + tax
//	no_tax    → tax 0,                   total = amount
//	""        → legacy per-rate behavior via rateInclusive
//
// amount is the discounted line value the rate applies to.
func ResolveLineTax(amount, ratePercentage float64, rateInclusive bool, taxMode string) (tax, total float64) {
	amount = roundMoney(amount)
	if amount <= 0 {
		return 0, amount
	}
	effectiveInclusive := rateInclusive
	switch taxMode {
	case TaxModeNoTax:
		return 0, amount
	case TaxModeInclusive:
		effectiveInclusive = true
	case TaxModeExclusive:
		effectiveInclusive = false
	}
	tax = calculateTax(amount, ratePercentage, effectiveInclusive)
	if effectiveInclusive {
		return tax, amount
	}
	return tax, roundMoney(amount + tax)
}

// DefaultTaxMode returns the business's default document tax mode
// (business_settings.default_tax_mode), falling back to inclusive.
func DefaultTaxMode(tx *gorm.DB, businessID string) string {
	var mode string
	if err := tx.Table("business_settings").
		Select("COALESCE(default_tax_mode, 'inclusive')").
		Where("business_id = ?", businessID).
		Scan(&mode).Error; err != nil || !ValidTaxMode(mode) {
		return TaxModeInclusive
	}
	return mode
}
