package bakeryorders

import "testing"

func TestParseEventDateKeepsSelectedCalendarDate(t *testing.T) {
	parsed, err := parseDate("2026-07-30", "event_date")
	if err != nil {
		t.Fatalf("parseDate returned error: %v", err)
	}

	if got := parsed.Format("2006-01-02"); got != "2026-07-30" {
		t.Fatalf("event date = %s, want 2026-07-30", got)
	}
	if !parsed.IsZero() && (parsed.Hour() != 0 || parsed.Minute() != 0 || parsed.Second() != 0) {
		t.Fatalf("event date should be stored as date-only midnight, got %s", parsed.Format("15:04:05"))
	}
}

func TestParseEventDateRejectsTimestampPayload(t *testing.T) {
	if _, err := parseDate("2026-07-30T00:00:00Z", "event_date"); err == nil {
		t.Fatal("expected timestamp event_date payload to be rejected")
	}
}
