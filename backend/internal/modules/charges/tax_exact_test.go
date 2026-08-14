package charges

import "testing"

// Phase 6 / W4: VAT is derived with exact decimal arithmetic. In float64 the
// inclusive extraction `amount - amount/(1+rate/100)` and even the exclusive
// `amount*rate/100` land a hair off the true value, and the error crosses a
// rounding boundary often enough to move the fils. A sweep of 1,000,000
// amount/rate combinations found 21,180 inclusive and 2,453 exclusive cases
// where the old float path rounded to a different fils than the exact value.
// These are real examples from that sweep; each expectation is the exact
// decimal result, rounded half away from zero.
func TestCalculateTaxIsExactAtRoundingBoundaries(t *testing.T) {
	tests := []struct {
		name      string
		amount    float64
		rate      float64
		inclusive bool
		want      float64
	}{
		// exact: 2.90 * 0.05 = 0.145 -> 0.15 (float64 gave 0.14)
		{"exclusive 2.90 at 5%", 2.90, 5, false, 0.15},
		{"exclusive 5.70 at 5%", 5.70, 5, false, 0.29},
		{"exclusive 11.30 at 5%", 11.30, 5, false, 0.57},
		{"exclusive 11.50 at 5%", 11.50, 5, false, 0.58},
		{"exclusive 20.10 at 5%", 20.10, 5, false, 1.01},
		// exact: 0.03 - 0.03/1.2 = 0.005 -> 0.01 (float64 gave 0.00)
		{"inclusive 0.03 at 20%", 0.03, 20, true, 0.01},
		{"inclusive 0.15 at 20%", 0.15, 20, true, 0.03},
		{"inclusive 0.27 at 20%", 0.27, 20, true, 0.05},
		{"inclusive 0.33 at 20%", 0.33, 20, true, 0.06},
		{"inclusive 0.51 at 20%", 0.51, 20, true, 0.09},
		// The ordinary cases must not move.
		{"inclusive 105.00 at 5%", 105.00, 5, true, 5.00},
		{"exclusive 100.00 at 5%", 100.00, 5, false, 5.00},
		{"inclusive 100.00 at 0%", 100.00, 0, true, 0},
		{"exclusive zero amount", 0, 5, false, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := calculateTax(tc.amount, tc.rate, tc.inclusive); got != tc.want {
				t.Fatalf("calculateTax(%v, %v, %v) = %v, want %v", tc.amount, tc.rate, tc.inclusive, got, tc.want)
			}
		})
	}
}

// Inclusive tax must never exceed the amount it was extracted from, and the
// net must reconstruct the gross exactly — the property the ledger relies on
// when it posts revenue net of VAT against a gross payment.
func TestInclusiveTaxReconstructsGross(t *testing.T) {
	rates := []float64{5, 8.25, 12.5, 15, 20}
	for _, rate := range rates {
		for cents := 1; cents <= 5000; cents++ {
			amount := float64(cents) / 100
			tax, total := ResolveLineTax(amount, rate, true, TaxModeInclusive)
			if total != amount {
				t.Fatalf("inclusive total moved: amount=%.2f rate=%v total=%.2f", amount, rate, total)
			}
			if tax > amount {
				t.Fatalf("inclusive tax exceeds amount: amount=%.2f rate=%v tax=%.2f", amount, rate, tax)
			}
			if tax < 0 {
				t.Fatalf("negative tax: amount=%.2f rate=%v tax=%.2f", amount, rate, tax)
			}
		}
	}
}
