package reports

import (
	"math"
	"strings"
	"testing"
)

// The tax report derives its taxable base from the tax actually charged, which
// is exact whether the rate was applied inclusively or exclusively. Confirm the
// arithmetic that justifies that, so the SQL is not "simplified" back to
// line_subtotal - discount_amount.
func TestTaxableBaseDerivationHoldsForBothTaxModes(t *testing.T) {
	const pct = 5.0
	const base = 200.0

	// Exclusive: tax is added on top of the base.
	exclusiveTax := base * pct / 100
	if got := exclusiveTax * 100 / pct; math.Abs(got-base) > 0.0001 {
		t.Errorf("exclusive: derived base %.4f, want %.4f", got, base)
	}

	// Inclusive: the customer pays `gross`, which already contains the tax.
	gross := base + exclusiveTax
	inclusiveTax := gross * pct / (100 + pct)
	if got := inclusiveTax * 100 / pct; math.Abs(got-base) > 0.0001 {
		t.Errorf("inclusive: derived base %.4f, want %.4f", got, base)
	}

	// And the old formula is what overstated an inclusive line: using the gross
	// as the base inflates it by exactly the tax.
	if math.Abs(gross-base-inclusiveTax) > 0.0001 {
		t.Errorf("expected the inclusive gross to exceed the base by the tax amount")
	}
}

func TestTaxReportDerivesBaseFromTaxCharged(t *testing.T) {
	body := readRepositoryFunction(t, "func (r *Repository) TaxReport(")

	if !strings.Contains(body, "si.tax_amount * 100.0 / si.tax_rate_percentage_snapshot") {
		t.Error("TaxReport no longer derives the taxable base from the tax charged")
	}
	// The zero-rate fallback must remain: with no tax rate there is nothing to
	// divide by.
	if !strings.Contains(body, "ELSE si.line_subtotal - si.discount_amount END") {
		t.Error("TaxReport lost its zero-rate fallback for the taxable base")
	}
}
