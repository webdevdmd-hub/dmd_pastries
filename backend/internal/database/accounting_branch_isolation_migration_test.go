package database

import (
	"os"
	"strings"
	"testing"
)

func TestAccountingBranchIsolationDropsLegacyIndexesBeforeCloning(t *testing.T) {
	source, err := os.ReadFile("../../migrations/000092_strict_accounting_branch_isolation.sql")
	if err != nil {
		t.Fatalf("read accounting branch isolation migration: %v", err)
	}

	sql := string(source)
	assertStatementOrder(t, sql,
		"DROP INDEX IF EXISTS idx_chart_of_accounts_business_code;",
		"INSERT INTO chart_of_accounts (",
	)
	assertStatementOrder(t, sql,
		"DROP INDEX IF EXISTS idx_accounting_account_mappings_unique_active;",
		"INSERT INTO accounting_account_mappings (",
	)
	assertStatementOrder(t, sql,
		"INSERT INTO chart_of_accounts (",
		"CREATE UNIQUE INDEX idx_chart_of_accounts_business_branch_code",
	)
	assertStatementOrder(t, sql,
		"INSERT INTO accounting_account_mappings (",
		"CREATE UNIQUE INDEX idx_accounting_account_mappings_branch_unique_active",
	)
}

func assertStatementOrder(t *testing.T, sql string, first string, second string) {
	t.Helper()

	firstIndex := strings.Index(sql, first)
	if firstIndex == -1 {
		t.Fatalf("migration is missing statement %q", first)
	}

	secondIndex := strings.Index(sql, second)
	if secondIndex == -1 {
		t.Fatalf("migration is missing statement %q", second)
	}

	if firstIndex >= secondIndex {
		t.Fatalf("statement %q must appear before %q", first, second)
	}
}
