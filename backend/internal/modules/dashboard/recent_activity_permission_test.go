package dashboard

import (
	"errors"
	"net/http"
	"net/url"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-067 — the dashboard's Recent Activity returned the audit
// trail (staff logins, users created and deleted, role changes) to any role
// with dashboard.view. On production on 2026-09-18 a till-only role read it
// on the Cashier dashboard while /audit-logs correctly denied it.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
func TestRecentActivityNeedsAuditLogsView(t *testing.T) {
	service := &Service{}
	// Both users get a scope the branch check accepts, so the permission is
	// the only thing that can refuse the first one. Without it the branch
	// check answered 403 on its own and the test passed with no guard at all.
	tillOnly := &utils.AuthContext{
		BusinessID:           "business",
		CanAccessAllBranches: true,
		Permissions:          []string{"dashboard.view", "pos.view", "pos.sell", "pos.checkout"},
	}

	_, err := service.RecentActivity(tillOnly, url.Values{})
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusForbidden {
		t.Fatalf("recent activity without audit_logs.view returned %v, want 403", err)
	}

	auditor := &utils.AuthContext{
		BusinessID:           "business",
		CanAccessAllBranches: true,
		Permissions:          []string{"dashboard.view", "audit_logs.view"},
	}
	// With no audit repository wired the call fails later, as an internal
	// error; what matters is that the permission let it through.
	_, err = service.RecentActivity(auditor, url.Values{})
	if errors.As(err, &appErr) && appErr.StatusCode == http.StatusForbidden {
		t.Fatalf("recent activity with audit_logs.view was refused: %v", err)
	}
}
