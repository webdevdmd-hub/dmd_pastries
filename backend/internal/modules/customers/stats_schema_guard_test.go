package customers

import (
	"os"
	"strings"
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

// Regression: ISSUE-011 — customer statistics returned 500 for every customer.
//
// CustomerStatsResponse carries RecentTransactions, a slice of structs. Without
// gorm:"-" GORM reads that as a has-many relation, cannot find a foreign key,
// and refuses to parse the struct at all:
//
//	invalid field found for struct …CustomerStatsResponse's field
//	RecentTransactions: define a valid foreign key for relations or implement
//	the Valuer/Scanner interface
//
// Stats() scans into this struct, so the FIRST query failed and the endpoint
// 500'd for every customer on every request. Confirmed on production against
// two customers, including one created with no transactions at all, which rules
// out anything data-dependent: GET /customers/{id}/stats returned 500 for both.
//
// It stayed invisible because the failure had a believable face. The customer
// list calls the same code through BasicStats and dropped the error, so every
// customer read "Total sales AED 0.00, Last purchase Never" -- indistinguishable
// from a customer who has genuinely never bought anything. That path now logs.
//
// This guard needs no database. Schema parsing is pure reflection, which is
// exactly why the bug could ship: nothing in the build or the type system
// objects, and the failure only appears at the first query against a live DB.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestCustomerScanTargetsParse(t *testing.T) {
	for _, target := range []struct {
		dest interface{}
		name string
		why  string
	}{
		{
			dest: &CustomerStatsResponse{},
			name: "CustomerStatsResponse",
			why:  "Stats() scans every one of its aggregate queries into this struct",
		},
		{
			dest: &CustomerResponse{},
			name: "CustomerResponse",
			why:  "the list and lookup paths scan into this struct",
		},
		{
			dest: &CustomerBasicStats{},
			name: "CustomerBasicStats",
			why:  "every row of the customer list embeds one of these",
		},
		{
			dest: &CustomerTransactionResponse{},
			name: "CustomerTransactionResponse",
			why:  "CustomerRecentTransactions scans the UNION into a slice of these",
		},
	} {
		if _, err := schema.Parse(target.dest, &sync.Map{}, schema.NamingStrategy{}); err != nil {
			t.Errorf(
				"%s cannot be parsed by GORM, so every query scanning into it fails at runtime "+
					"with no compile-time warning (%s): %v",
				target.name, target.why, err,
			)
		}
	}
}

// A slice of structs on a scan target must be marked gorm:"-" or GORM tries to
// make a relation out of it. The parse check above catches that, but only for
// the structs listed there; this one states the rule on the field that broke,
// so removing the tag fails with the reason rather than a GORM error string.
func TestStatsTransactionsAreNotAGormRelation(t *testing.T) {
	raw, err := os.ReadFile("dto.go")
	if err != nil {
		t.Fatalf("read dto.go: %v", err)
	}
	source := string(raw)
	declaration := structSource(source, "type CustomerStatsResponse struct {")
	if declaration == "" {
		t.Fatal("CustomerStatsResponse not found in dto.go")
	}
	for _, line := range strings.Split(declaration, "\n") {
		if !strings.Contains(line, "RecentTransactions") || strings.HasPrefix(strings.TrimSpace(line), "//") {
			continue
		}
		if !strings.Contains(line, `gorm:"-"`) {
			t.Error(`RecentTransactions must carry gorm:"-": it is a slice of structs on a struct ` +
				`GORM scans into, and without the tag GORM reads it as a has-many, fails to parse ` +
				`the whole struct, and every customer stats request returns 500`)
		}
		return
	}
	t.Error("no RecentTransactions field found on CustomerStatsResponse")
}

func structSource(body, marker string) string {
	body = strings.ReplaceAll(body, "\r\n", "\n")
	start := strings.Index(body, marker)
	if start == -1 {
		return ""
	}
	rest := body[start:]
	if end := strings.Index(rest, "\n}"); end != -1 {
		return rest[:end]
	}
	return rest
}
