package pos

import "testing"

// Phase 6 / W4: a percentage discount is exact decimal arithmetic. In float64
// `base*value/100` lands a hair off whenever the true product sits on a
// half-fils boundary, and the discount - which is money off a customer's bill
// - rounds to the wrong fils. These are true-value expectations, rounded half
// away from zero.
func TestPercentageDiscountIsExact(t *testing.T) {
	percentage := "percentage"
	tests := []struct {
		name  string
		base  float64
		value float64
		want  float64
	}{
		// 2.90 * 5% = 0.145 exactly -> 0.15 (float64 gave 0.14)
		{"2.90 at 5%", 2.90, 5, 0.15},
		{"5.70 at 5%", 5.70, 5, 0.29},
		{"11.30 at 5%", 11.30, 5, 0.57},
		{"20.10 at 5%", 20.10, 5, 1.01},
		// ordinary cases must not move
		{"100.00 at 10%", 100.00, 10, 10.00},
		{"49.99 at 20%", 49.99, 20, 10.00},
		{"0 at 10%", 0, 10, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := calculateDiscount(&percentage, tc.value, tc.base)
			if err != nil {
				t.Fatalf("calculateDiscount: %v", err)
			}
			if got != tc.want {
				t.Fatalf("calculateDiscount(%v%%, base %v) = %v, want %v", tc.value, tc.base, got, tc.want)
			}
		})
	}
}

// A percentage discount can never exceed the amount it discounts.
func TestPercentageDiscountNeverExceedsBase(t *testing.T) {
	percentage := "percentage"
	for cents := 1; cents <= 20000; cents++ {
		base := float64(cents) / 100
		for _, rate := range []float64{5, 12.5, 33.33, 100} {
			got, err := calculateDiscount(&percentage, rate, base)
			if err != nil {
				t.Fatalf("calculateDiscount: %v", err)
			}
			if got > base {
				t.Fatalf("discount %v exceeds base %v at %v%%", got, base, rate)
			}
		}
	}
}
