package pos

import "testing"

// Regression: ISSUE-001 — a sale that comes to nothing was recorded as unpaid.
//
// A comp, a staff meal or a 100%-off promotion totals zero and takes no
// tender, so paid and total are both zero. paymentStatus checked `paid <= 0`
// first and returned "unpaid", which parked a sale that owes nothing in
// outstanding balances with no way to settle it: there is no payment to
// record, because nothing is due.
//
// Checkout already allows the shape (it only demands payments when
// TotalAmount > 0), so the status was the piece that disagreed.
//
// Found by /qa on 2026-09-14.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
func TestPaymentStatusSettlesASaleThatOwesNothing(t *testing.T) {
	tests := []struct {
		name  string
		paid  float64
		total float64
		want  string
	}{
		// The regression itself: nothing owed, nothing tendered.
		{"comped sale, no tender", 0, 0, "paid"},
		// A rounding crumb under half a fils is still nothing owed.
		{"total rounds to nothing", 0, 0.00005, "paid"},
		// Someone tendered on a zero-total sale (the old workaround). Still
		// settled; the overpay becomes change, it is not a partial payment.
		{"zero total with cash tendered", 10, 0, "paid"},

		// Ordinary sales must not move.
		{"nothing paid on a real sale", 0, 351, "unpaid"},
		{"part paid", 100, 351, "partial"},
		{"paid in full", 351, 351, "paid"},
		{"overpaid with cash for change", 400, 351, "paid"},
		{"a fils short is still partial", 350.99, 351, "partial"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := paymentStatus(tc.paid, tc.total); got != tc.want {
				t.Fatalf("paymentStatus(paid %v, total %v) = %q, want %q", tc.paid, tc.total, got, tc.want)
			}
		})
	}
}
