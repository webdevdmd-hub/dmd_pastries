package charges

import "testing"

// Phase 4 / W3 acceptance #1: the same AED 100 line at 5% under the three
// modes — inclusive → pay 100 (tax 4.76), exclusive → pay 105 (tax 5),
// no_tax → pay 100 (tax 0). The legacy sentinel keeps the rate's own flag.
func TestResolveLineTax(t *testing.T) {
	cases := []struct {
		name          string
		mode          string
		rateInclusive bool
		wantTax       float64
		wantTotal     float64
	}{
		{"inclusive mode extracts tax", TaxModeInclusive, false, 4.76, 100},
		{"exclusive mode adds tax", TaxModeExclusive, true, 5, 105},
		{"no_tax zeroes tax", TaxModeNoTax, true, 0, 100},
		{"legacy honors inclusive rate", TaxModePerRate, true, 4.76, 100},
		{"legacy honors exclusive rate", TaxModePerRate, false, 5, 105},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			tax, total := ResolveLineTax(100, 5, testCase.rateInclusive, testCase.mode)
			if tax != testCase.wantTax {
				t.Fatalf("tax = %v, want %v", tax, testCase.wantTax)
			}
			if total != testCase.wantTotal {
				t.Fatalf("total = %v, want %v", total, testCase.wantTotal)
			}
		})
	}
}

func TestValidTaxMode(t *testing.T) {
	for _, valid := range []string{"inclusive", "exclusive", "no_tax"} {
		if !ValidTaxMode(valid) {
			t.Fatalf("%s must be a valid tax mode", valid)
		}
	}
	for _, invalid := range []string{"", "auto", "per_rate", "NO_TAX"} {
		if ValidTaxMode(invalid) {
			t.Fatalf("%s must not be a valid tax mode", invalid)
		}
	}
}
