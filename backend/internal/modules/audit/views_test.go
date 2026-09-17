package audit

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-060 — see views.go. Owner decision: record a view once per
// 30 minutes per person, and show changes only unless views are asked for.

func TestViewEvents(t *testing.T) {
	for event, want := range map[string]bool{
		"report.summary_viewed":               true, // the measured flood
		"dashboard.admin_viewed":              true,
		"payment.summary.viewed":              true,
		"accounting.reconciliation_ap_viewed": true,
		"role.permissions_updated":            false,
		"user.soft_deleted":                   false,
		"accounting.journal_entry_reversed":   false,
	} {
		if got := IsViewEvent(event); got != want {
			t.Errorf("IsViewEvent(%q) = %v, want %v", event, got, want)
		}
	}
	if viewRepeatWindow.Minutes() != 30 {
		t.Errorf("repeat window = %v, want the owner's 30 minutes", viewRepeatWindow)
	}
}

func auditSource(t *testing.T, name, marker string) string {
	t.Helper()
	raw, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(source, marker)
	if start == -1 {
		t.Fatalf("%s not found in %s", marker, name)
	}
	rest := source[start+len(marker):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}

func TestRepeatedViewsAreNotRecordedAgain(t *testing.T) {
	body := auditSource(t, "repository.go", "func (r *Repository) CreateActivity(")
	guard := strings.Index(body, "if IsViewEvent(input.EventType) {")
	window := strings.Index(body, "time.Now().UTC().Add(-viewRepeatWindow)")
	create := strings.Index(body, "tx.Create(&AuditLog{")
	if guard == -1 || window == -1 || create == -1 || guard > create || window > create {
		t.Error("CreateActivity must skip a view the same person recorded within the window, before inserting")
	}
	for _, key := range []string{"actor_user_id = ?", "event_type = ?", "entity_id = ?"} {
		if !strings.Contains(body, key) {
			t.Errorf("the repeat check must match on %s, or different views are dropped", key)
		}
	}
}

func TestTheFeedShowsChangesUnlessViewsAreIncluded(t *testing.T) {
	body := auditSource(t, "repository.go", "func (r *Repository) ListActivity(")
	if !strings.Contains(body, "if !filter.IncludeViews {") || !strings.Contains(body, `query.Where("NOT " + viewEventSQL)`) {
		t.Error("ListActivity must hide views unless IncludeViews is set")
	}
	if !strings.Contains(viewEventSQL, "COALESCE(event_type, '')") {
		t.Error("old rows with no event_type must stay visible in the changes view")
	}
	for _, file := range []string{"handler.go", "../users/handler.go"} {
		raw, _ := os.ReadFile(file)
		if !strings.Contains(string(raw), `IncludeViews: c.Query("include_views") == "true"`) {
			t.Errorf("%s must pass include_views through", file)
		}
	}
}
