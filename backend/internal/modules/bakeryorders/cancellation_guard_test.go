package bakeryorders

import "testing"

// Phase 4 / W6: money must never strand on cancellation — advances are
// refunded first, and partially-refunded completed orders cannot be
// mirror-reversed a second time.
func TestBakeryOrderCancellationBlocked(t *testing.T) {
	cases := []struct {
		name     string
		status   string
		paid     float64
		refunded float64
		blocked  bool
	}{
		{"unpaid new order cancels freely", "new", 0, 0, false},
		{"order with advances is blocked", "confirmed", 50, 0, true},
		{"order with refunded advances cancels", "confirmed", 0, 0, false},
		{"completed fully-paid order cancels (reversal restores the advance)", "completed", 105, 0, false},
		{"completed order with post-completion refunds is blocked", "completed", 105, 20, true},
		{"sub-cent residue does not block", "confirmed", 0.004, 0, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			reason, ok := bakeryOrderCancellationBlocked(testCase.status, testCase.paid, testCase.refunded)
			if testCase.blocked && ok {
				t.Fatal("expected cancellation to be blocked")
			}
			if !testCase.blocked && !ok {
				t.Fatalf("expected cancellation to be allowed, got blocked: %s", reason)
			}
			if testCase.blocked && reason == "" {
				t.Fatal("blocked cancellation must carry a user-facing reason")
			}
		})
	}
}
