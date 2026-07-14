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
	assertStatementOrder(t, sql,
		"CREATE TEMP TABLE tmp_payment_account_merge",
		"UPDATE payment_accounts payment\nSET branch_id = defaults.branch_id",
	)
	assertStatementOrder(t, sql,
		"UPDATE payment_methods method",
		"UPDATE payment_accounts legacy\nSET branch_id = merge.branch_id",
	)
	assertStatementOrder(t, sql,
		"UPDATE payment_method_account_mappings mapping",
		"UPDATE payment_accounts legacy\nSET branch_id = merge.branch_id",
	)
	assertStatementOrder(t, sql,
		"SET account_name = LEFT(legacy.account_name, 132)",
		"UPDATE payment_accounts payment\nSET branch_id = defaults.branch_id",
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
