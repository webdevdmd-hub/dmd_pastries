package accounting

import (
	"testing"
	"time"
)

// Phase 4 / W1: bakery journals must land in the order's own period. A past
// event date wins over the clock (backfilled/late completions); a future or
// zero event date falls back to now (live completion before the event day).
func TestBakeryOrderEntryDate(t *testing.T) {
	past := time.Now().UTC().AddDate(0, -1, 0)
	if got := bakeryOrderEntryDate(past); !got.Equal(past) {
		t.Fatalf("past event date must win: got %v want %v", got, past)
	}
	future := time.Now().UTC().AddDate(0, 1, 0)
	if got := bakeryOrderEntryDate(future); got.Equal(future) {
		t.Fatalf("future event date must not be used as entry date")
	}
	if got := bakeryOrderEntryDate(time.Time{}); got.IsZero() {
		t.Fatalf("zero event date must fall back to now")
	}
}
