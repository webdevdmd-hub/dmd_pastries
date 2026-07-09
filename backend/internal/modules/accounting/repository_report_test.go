package accounting

import (
	"strings"
	"testing"
)

func TestAccountForReportWhereClauseAllowsSystemControlAndManualDisabledAccounts(t *testing.T) {
	if !strings.Contains(accountForReportWhereClause, "deleted_at IS NULL") {
		t.Fatalf(
			"report account lookup must exclude deleted accounts, got clause %q",
			accountForReportWhereClause,
		)
	}
	if strings.Contains(accountForReportWhereClause, "status =") ||
		strings.Contains(accountForReportWhereClause, "allow_manual_posting") ||
		strings.Contains(accountForReportWhereClause, "is_system_account") ||
		strings.Contains(accountForReportWhereClause, "is_control_account") ||
		strings.Contains(accountForReportWhereClause, "account_type") {
		t.Fatalf(
			"report account lookup must not restrict status, system/control flags, account type, or manual posting, got clause %q",
			accountForReportWhereClause,
		)
	}
}

func TestDefaultInventoryStockAccountIsReportableControlAccount(t *testing.T) {
	var found bool
	for _, seed := range DefaultChartAccountSeeds() {
		if seed.Code != "1200" {
			continue
		}
		found = true
		if seed.Name != "Inventory / Stock" {
			t.Fatalf("inventory stock account name = %q, want Inventory / Stock", seed.Name)
		}
		if seed.Type != "asset" {
			t.Fatalf("inventory stock account type = %q, want asset", seed.Type)
		}
		if seed.Group != "current_asset" {
			t.Fatalf("inventory stock account group = %q, want current_asset", seed.Group)
		}
		if seed.NormalBalance != "debit" {
			t.Fatalf("inventory stock normal balance = %q, want debit", seed.NormalBalance)
		}
		if !seed.IsControlAccount {
			t.Fatal("inventory stock account must remain a control account")
		}
		if seed.AllowManualPosting {
			t.Fatal("inventory stock account must not allow manual posting")
		}
	}
	if !found {
		t.Fatal("default chart account seeds must include 1200 - Inventory / Stock")
	}
}

func TestLedgerWhereClauseFiltersByJournalLineAccountOnly(t *testing.T) {
	where, args := ledgerWhereClause("business-id", "inventory-account-id", "")
	if !strings.Contains(where, "jel.account_id = ?") {
		t.Fatalf("ledger account filter must use journal line account_id, got clause %q", where)
	}
	if strings.Contains(where, "coa.status") ||
		strings.Contains(where, "allow_manual_posting") ||
		strings.Contains(where, "is_system_account") ||
		strings.Contains(where, "is_control_account") ||
		strings.Contains(where, "account_type") {
		t.Fatalf(
			"ledger account filter must not restrict reportable account flags or types, got clause %q",
			where,
		)
	}
	if len(args) != 2 || args[0] != "business-id" || args[1] != "inventory-account-id" {
		t.Fatalf("ledger account filter args = %#v, want business and account IDs", args)
	}
}
