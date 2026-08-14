package accounting

import (
	"testing"
	"time"

	apperrors "pastries-pos/internal/shared/errors"
)

func dateUTC(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func TestPeriodLockedByNilLockAllowsEverything(t *testing.T) {
	if periodLockedBy(nil, dateUTC(2020, time.January, 1)) {
		t.Fatal("nil lock must never block a posting")
	}
}

func TestPeriodLockedByBoundaryIsInclusive(t *testing.T) {
	lock := dateUTC(2026, time.June, 30)
	cases := []struct {
		name    string
		entry   time.Time
		blocked bool
	}{
		{"day before lock", dateUTC(2026, time.June, 29), true},
		{"on the lock date", dateUTC(2026, time.June, 30), true},
		{"day after lock", dateUTC(2026, time.July, 1), false},
	}
	for _, tc := range cases {
		if got := periodLockedBy(&lock, tc.entry); got != tc.blocked {
			t.Errorf("%s: periodLockedBy = %v, want %v", tc.name, got, tc.blocked)
		}
	}
}

func TestPeriodLockedByTruncatesTimestampsToUTCDates(t *testing.T) {
	lock := dateUTC(2026, time.June, 30)
	gulf := time.FixedZone("GST", 4*60*60)
	// 2026-07-01 02:00 GST is still 2026-06-30 22:00 UTC — locked.
	insideLock := time.Date(2026, time.July, 1, 2, 0, 0, 0, gulf)
	if !periodLockedBy(&lock, insideLock) {
		t.Fatal("timestamp inside the locked UTC date must be blocked")
	}
	// 2026-07-01 06:00 GST is 2026-07-01 02:00 UTC — open.
	afterLock := time.Date(2026, time.July, 1, 6, 0, 0, 0, gulf)
	if periodLockedBy(&lock, afterLock) {
		t.Fatal("timestamp after the locked UTC date must be allowed")
	}
	// A lock stored with a stray time component still locks its whole day.
	lockWithTime := time.Date(2026, time.June, 30, 23, 59, 59, 0, time.UTC)
	if !periodLockedBy(&lockWithTime, dateUTC(2026, time.June, 30)) {
		t.Fatal("lock date with a time component must still block its day")
	}
}

func TestPeriodLockedErrorIsRecognizable(t *testing.T) {
	err := periodLockedError(dateUTC(2026, time.June, 30), dateUTC(2026, time.June, 15))
	if !IsPeriodLockedError(err) {
		t.Fatal("periodLockedError must be recognized by IsPeriodLockedError")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected *AppError, got %T", err)
	}
	if appErr.StatusCode != 422 {
		t.Fatalf("expected 422, got %d", appErr.StatusCode)
	}
	if appErr.Message != "accounting period is locked through 2026-06-30" {
		t.Fatalf("unexpected message: %q", appErr.Message)
	}
}

func TestIsPeriodLockedErrorRejectsOtherErrors(t *testing.T) {
	if IsPeriodLockedError(nil) {
		t.Fatal("nil is not a period-lock error")
	}
	if IsPeriodLockedError(apperrors.BadRequest("nope", nil)) {
		t.Fatal("a BadRequest without the reason marker is not a period-lock error")
	}
	if IsPeriodLockedError(apperrors.BadRequest("nope", map[string]interface{}{"reason": "other"})) {
		t.Fatal("a different reason marker is not a period-lock error")
	}
}
