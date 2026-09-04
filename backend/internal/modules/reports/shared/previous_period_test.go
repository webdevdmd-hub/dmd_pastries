package shared

import (
	"testing"
	"time"
)

func TestPreviousPeriodShiftsBackByItsOwnLength(t *testing.T) {
	start := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 9, 8, 0, 0, 0, 0, time.UTC)

	filter := &ResolvedFilter{
		DateFrom: start,
		DateTo:   end,
		EndUTC:   end,
		StartUTC: start,
	}

	previous := filter.PreviousPeriod()
	if previous == nil {
		t.Fatal("PreviousPeriod returned nil for a seven-day window")
	}

	wantStart := time.Date(2026, 8, 25, 0, 0, 0, 0, time.UTC)
	if !previous.StartUTC.Equal(wantStart) {
		t.Errorf("StartUTC = %v, want %v", previous.StartUTC, wantStart)
	}

	// The previous window ends exactly where this one begins, so no row can
	// fall inside both and be counted twice.
	if !previous.EndUTC.Equal(start) {
		t.Errorf("EndUTC = %v, want %v", previous.EndUTC, start)
	}

	if got := previous.EndUTC.Sub(previous.StartUTC); got != end.Sub(start) {
		t.Errorf("previous window length = %v, want %v", got, end.Sub(start))
	}
}

func TestPreviousPeriodLeavesTheOriginalFilterAlone(t *testing.T) {
	start := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC)

	filter := &ResolvedFilter{
		BranchID: "branch-1",
		DateFrom: start,
		DateTo:   end,
		EndUTC:   end,
		StartUTC: start,
	}

	_ = filter.PreviousPeriod()

	if !filter.StartUTC.Equal(start) || !filter.EndUTC.Equal(end) {
		t.Error("PreviousPeriod mutated the receiver; it must return a copy")
	}
}

func TestPreviousPeriodKeepsScope(t *testing.T) {
	filter := &ResolvedFilter{
		AllBranches: true,
		BranchID:    "branch-1",
		BusinessID:  "business-1",
		DateFrom:    time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		DateTo:      time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC),
		EndUTC:      time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC),
		StartUTC:    time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		Timezone:    "Asia/Dubai",
	}

	previous := filter.PreviousPeriod()
	if previous == nil {
		t.Fatal("PreviousPeriod returned nil")
	}

	// A comparison against a different branch or business would be worse than
	// no comparison at all.
	if previous.BusinessID != filter.BusinessID ||
		previous.BranchID != filter.BranchID ||
		previous.AllBranches != filter.AllBranches ||
		previous.Timezone != filter.Timezone {
		t.Error("PreviousPeriod changed the scope; only the window may move")
	}
}

func TestPreviousPeriodRefusesAnEmptyWindow(t *testing.T) {
	instant := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	filter := &ResolvedFilter{
		DateFrom: instant,
		DateTo:   instant,
		EndUTC:   instant,
		StartUTC: instant,
	}

	// A zero-length window has no previous window, and shifting by zero would
	// return the same range -- a 0% delta that looks measured but is not.
	if previous := filter.PreviousPeriod(); previous != nil {
		t.Errorf("PreviousPeriod returned %+v for a zero-length window, want nil", previous)
	}
}

func TestPreviousPeriodOnNilFilter(t *testing.T) {
	var filter *ResolvedFilter
	if previous := filter.PreviousPeriod(); previous != nil {
		t.Error("PreviousPeriod on a nil filter should return nil")
	}
}
