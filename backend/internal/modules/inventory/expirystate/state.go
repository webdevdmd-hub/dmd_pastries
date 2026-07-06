package expirystate

import (
	"strings"
	"time"
)

const (
	StateExpired      = "expired"
	StateExpiresToday = "expires_today"
	StateExpiringSoon = "expiring_soon"
)

const DefaultTimezone = "Asia/Dubai"

func ResolveTimezone(value string) (*time.Location, string, error) {
	name := strings.TrimSpace(value)
	if name == "" {
		name = DefaultTimezone
	}
	location, err := time.LoadLocation(name)
	if err != nil {
		return nil, name, err
	}
	return location, name, nil
}

func LocalDate(now time.Time, location *time.Location) time.Time {
	local := now.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}

func DaysRemaining(expiryDate time.Time, today time.Time) int {
	expiry := time.Date(expiryDate.In(today.Location()).Year(), expiryDate.In(today.Location()).Month(), expiryDate.In(today.Location()).Day(), 0, 0, 0, 0, today.Location())
	return int(expiry.Sub(today).Hours() / 24)
}

func State(daysRemaining int) string {
	if daysRemaining < 0 {
		return StateExpired
	}
	if daysRemaining == 0 {
		return StateExpiresToday
	}
	return StateExpiringSoon
}

func Label(state string) string {
	switch state {
	case StateExpired:
		return "Expired / Overdue"
	case StateExpiresToday:
		return "Expires Today"
	case StateExpiringSoon:
		return "Expiring Soon"
	default:
		return ""
	}
}

func IsValidFilter(value string) bool {
	switch strings.TrimSpace(value) {
	case "", "all", StateExpired, StateExpiresToday, StateExpiringSoon:
		return true
	default:
		return false
	}
}
