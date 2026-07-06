package audit

import (
	"testing"
	"time"

	apperrors "pastries-pos/internal/shared/errors"
)

func TestResolveActivityLogDateRangeUsesBusinessTimezoneDay(t *testing.T) {
	location, err := time.LoadLocation("Asia/Dubai")
	if err != nil {
		t.Fatalf("load Dubai location: %v", err)
	}

	startUTC, endUTC, err := resolveActivityLogDateRange("2026-06-25", "2026-06-25", location)
	if err != nil {
		t.Fatalf("resolve date range: %v", err)
	}
	if startUTC == nil || endUTC == nil {
		t.Fatal("expected both UTC boundaries")
	}

	expectedStart := time.Date(2026, 6, 24, 20, 0, 0, 0, time.UTC)
	expectedEnd := time.Date(2026, 6, 25, 20, 0, 0, 0, time.UTC)
	if !startUTC.Equal(expectedStart) {
		t.Fatalf("startUTC = %s, want %s", startUTC.Format(time.RFC3339), expectedStart.Format(time.RFC3339))
	}
	if !endUTC.Equal(expectedEnd) {
		t.Fatalf("endUTC = %s, want %s", endUTC.Format(time.RFC3339), expectedEnd.Format(time.RFC3339))
	}

	included := time.Date(2026, 6, 24, 20, 30, 0, 0, time.UTC)
	excluded := time.Date(2026, 6, 25, 20, 30, 0, 0, time.UTC)
	if included.Before(*startUTC) || !included.Before(*endUTC) {
		t.Fatalf("Dubai local 2026-06-25 boundary should include %s", included.Format(time.RFC3339))
	}
	if !excluded.After(*startUTC) || excluded.Before(*endUTC) {
		t.Fatalf("Dubai local 2026-06-25 boundary should exclude %s", excluded.Format(time.RFC3339))
	}
}

func TestResolveActivityLogDateRangeRejectsInvalidDate(t *testing.T) {
	location := time.UTC
	_, _, err := resolveActivityLogDateRange("2026/06/25", "2026-06-25", location)
	if err == nil {
		t.Fatal("expected invalid date error")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok || appErr.Message != "date_from must use YYYY-MM-DD" {
		t.Fatalf("unexpected error: %#v", err)
	}
}

func TestResolveActivityLogFilterRejectsInvalidTimezone(t *testing.T) {
	_, err := (&Repository{}).ResolveActivityLogFilter("business-id", ActivityLogQuery{Timezone: "Mars/Olympus"}, 50)
	if err == nil {
		t.Fatal("expected invalid timezone error")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok || appErr.Message != "invalid timezone" {
		t.Fatalf("unexpected error: %#v", err)
	}
}
