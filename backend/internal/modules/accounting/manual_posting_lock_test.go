package accounting

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Regression: ISSUE-039 — accounts meant to be locked against manual posting never were.
//
// ChartAccount.AllowManualPosting carried gorm:"default:true", and GORM writes a
// tag default in place of false, so the column was always TRUE. No seeded account was ever locked, and neither was an
// account created in the UI with "Allow manual posting" unchecked. On
// production on 2026-09-16 the expense form offered 5000 Opening Stock, 5070
// Cost of Goods Sold and 1030 Card Clearing.
//
// Owner decision, same day: lock exactly the accounts the app fills by itself
// -- Card Clearing and the cost-of-sales automatics -- add 5095 for hand
// corrections, and leave every other account as it has always behaved.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md

var ownerApprovedLocks = []string{"1030", "5000", "5010", "5020", "5050", "5070", "5080", "5090"}

// That the INSERT carries false is checked in
// settings/create_insert_values_test.go (ISSUE-063): the first fix here added
// Select("*"), which GORM ignores for tag defaults, and a test that only read
// the source for it passed.

// New businesses get exactly the owner's locks -- the same accounts the
// migration locks on existing ones -- so the two never behave differently.
func TestSeededLocksAreExactlyTheOwnerApprovedSet(t *testing.T) {
	var locked []string
	var adjustments *defaultAccountSeed
	for _, seed := range DefaultChartAccountSeeds() {
		if seed.IsHeader {
			continue
		}
		if !seed.AllowManualPosting {
			locked = append(locked, seed.Code)
		}
		if seed.Code == "5095" {
			copied := seed
			adjustments = &copied
		}
	}
	sort.Strings(locked)
	if strings.Join(locked, ",") != strings.Join(ownerApprovedLocks, ",") {
		t.Errorf("seeded locked accounts = %v, want exactly %v. Locking more changes what accountants can "+
			"post by hand, which the owner deferred; locking fewer re-exposes an automatic account", locked, ownerApprovedLocks)
	}

	if adjustments == nil {
		t.Fatal("5095 Cost of Sales Adjustments (manual) must be seeded: it is where hand corrections go now " +
			"that the automatic accounts are locked")
	}
	if adjustments.Name != "Cost of Sales Adjustments (manual)" || adjustments.Type != "cogs" ||
		adjustments.Parent != "50" || !adjustments.AllowManualPosting || adjustments.IsControlAccount {
		t.Errorf("5095 = %+v, want a postable, non-control cogs account under 50 Cost of Sales", *adjustments)
	}
}

// Existing businesses: the migration locks the same set and adds 5095, without
// touching operator-created accounts or anything else.
func TestLockMigrationMatchesTheSeed(t *testing.T) {
	raw, err := os.ReadFile("../../../migrations/000115_lock_automatic_cost_accounts.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	sql := strings.ReplaceAll(string(raw), "\r\n", "\n")
	code := regexp.MustCompile(`(?m)^\s*--.*$`).ReplaceAllString(sql, "")

	match := regexp.MustCompile(`account_code IN \(([^)]*)\)`).FindStringSubmatch(code)
	if match == nil {
		t.Fatal("migration has no account_code IN (...) list for the locks")
	}
	var codes []string
	for _, part := range strings.Split(match[1], ",") {
		codes = append(codes, strings.Trim(strings.TrimSpace(part), "'"))
	}
	sort.Strings(codes)
	if strings.Join(codes, ",") != strings.Join(ownerApprovedLocks, ",") {
		t.Errorf("migration locks %v, want exactly %v", codes, ownerApprovedLocks)
	}
	for _, guard := range []string{"is_system_account = TRUE", "SET allow_manual_posting = FALSE"} {
		if !strings.Contains(code, guard) {
			t.Errorf("migration must include %q so it only re-locks seeded system accounts", guard)
		}
	}
	for _, want := range []string{"'5095'", "'Cost of Sales Adjustments (manual)'", "header.account_code = '50'", "NOT EXISTS"} {
		if !strings.Contains(code, want) {
			t.Errorf("migration must add 5095 idempotently under the 50 header; missing %q", want)
		}
	}
}

func readAccountingSource(t *testing.T, name string) string {
	t.Helper()
	raw, err := os.ReadFile(name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}
