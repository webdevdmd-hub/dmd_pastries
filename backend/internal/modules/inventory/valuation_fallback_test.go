package inventory

import "testing"

// The defect this guards: products sold before any purchase/production had
// average_unit_cost = 0, so sale_out movements were recorded at zero cost and
// the COGS journal silently posted nothing. The outbound unit cost must fall
// back to the master-data cost price — and only when nothing better exists.
func TestOutboundUnitCostBasis(t *testing.T) {
	cases := []struct {
		name                     string
		input, average, costBase float64
		want                     float64
	}{
		{"explicit input wins over everything", 4.5, 3.0, 2.0, 4.5},
		{"average wins over product cost basis", 0, 3.0, 2.0, 3.0},
		{"product cost basis used only as last resort", 0, 0, 2.0, 2.0},
		{"nothing available", 0, 0, 0, 0},
		{"negative input falls through to average", -1, 3.0, 2.0, 3.0},
		{"negative average falls through to cost basis", 0, -1, 2.0, 2.0},
		{"negative cost basis yields zero", 0, 0, -5, 0},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := outboundUnitCostBasis(tt.input, tt.average, tt.costBase); got != tt.want {
				t.Fatalf("outboundUnitCostBasis(%v, %v, %v) = %v, want %v", tt.input, tt.average, tt.costBase, got, tt.want)
			}
		})
	}
}
