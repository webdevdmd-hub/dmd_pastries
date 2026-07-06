package accounting

import (
	"strings"
	"testing"
)

func TestAccountForReportWhereClauseAllowsSystemAndInactiveAccounts(t *testing.T) {
	if !strings.Contains(accountForReportWhereClause, "deleted_at IS NULL") {
		t.Fatalf(
			"report account lookup must exclude deleted accounts, got clause %q",
			accountForReportWhereClause,
		)
	}
	if strings.Contains(accountForReportWhereClause, "status =") ||
		strings.Contains(accountForReportWhereClause, "allow_manual_posting") {
		t.Fatalf(
			"report account lookup must not restrict status or manual posting, got clause %q",
			accountForReportWhereClause,
		)
	}
}
