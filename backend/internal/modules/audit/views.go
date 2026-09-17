package audit

import (
	"strings"
	"time"
)

// Owner decision 2026-09-17 (ISSUE-060): a view is recorded, but the same
// person repeating the same view within this window is not.
//
// Regression: ISSUE-060 — every report and dashboard request wrote a "viewed"
// entry, and the dashboard refreshes itself every minute (its own data plus
// three chart reports). On production 48 of the newest 50 entries were
// "Jo viewed report summary" / "viewed dashboard admin", four a minute for as
// long as a dashboard stayed open, and the day's real changes were two lines
// among them.
const viewRepeatWindow = 30 * time.Minute

// IsViewEvent reports whether an event records looking at something rather
// than changing it ("report.summary_viewed", "payment.summary.viewed").
func IsViewEvent(eventType string) bool {
	return strings.HasSuffix(eventType, "_viewed") || strings.HasSuffix(eventType, ".viewed")
}

// viewEventSQL matches the same events in the database.
// event_type is nullable on old rows; COALESCE keeps them in the changes view.
const viewEventSQL = "(RIGHT(COALESCE(event_type, ''), 7) IN ('_viewed', '.viewed'))"
