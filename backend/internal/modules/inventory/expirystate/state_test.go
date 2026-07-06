package expirystate

import (
	"testing"
	"time"
)

func TestStateClassifiesExpiryDates(t *testing.T) {
	location := time.FixedZone("GST", 4*60*60)
	today := time.Date(2026, 7, 7, 0, 0, 0, 0, location)

	tests := []struct {
		name       string
		expiryDate time.Time
		state      string
		days       int
	}{
		{
			name:       "future date is expiring soon",
			expiryDate: time.Date(2026, 7, 17, 0, 0, 0, 0, location),
			state:      StateExpiringSoon,
			days:       10,
		},
		{
			name:       "today expires today",
			expiryDate: time.Date(2026, 7, 7, 0, 0, 0, 0, location),
			state:      StateExpiresToday,
			days:       0,
		},
		{
			name:       "past date is expired",
			expiryDate: time.Date(2026, 7, 5, 0, 0, 0, 0, location),
			state:      StateExpired,
			days:       -2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			days := DaysRemaining(tt.expiryDate, today)
			if days != tt.days {
				t.Fatalf("DaysRemaining() = %d, want %d", days, tt.days)
			}
			if state := State(days); state != tt.state {
				t.Fatalf("State() = %q, want %q", state, tt.state)
			}
		})
	}
}

func TestLocalDateUsesBusinessTimezoneBoundary(t *testing.T) {
	location, err := time.LoadLocation(DefaultTimezone)
	if err != nil {
		t.Fatalf("load timezone: %v", err)
	}

	nowUTC := time.Date(2026, 7, 6, 21, 30, 0, 0, time.UTC)
	today := LocalDate(nowUTC, location)
	expiryDate := time.Date(2026, 7, 7, 0, 0, 0, 0, location)

	if got := today.Format("2006-01-02"); got != "2026-07-07" {
		t.Fatalf("LocalDate() = %s, want 2026-07-07", got)
	}
	if days := DaysRemaining(expiryDate, today); days != 0 {
		t.Fatalf("Dubai-local expiry should be today, got %d days", days)
	}
}
