package suppliers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Regression: ISSUE-020 — suppliers with purchase history could be deleted.
//
// The supplier menu promises "Delete — Only if nothing references it." Nothing
// checked. DeleteSupplier soft-deleted and deactivated unconditionally, so a
// supplier with open bills and an unpaid balance could be deleted. Every payment
// against those bills then failed ValidateSupplier, which requires an active,
// undeleted supplier: the liability stayed on the books and became unpayable in
// the app.
//
// Products already refuse this ("Product has transaction history and cannot be
// deleted. Deactivate it instead."). Suppliers now do the same.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestDeleteSupplierChecksHistoryBeforeDeleting(t *testing.T) {
	service := readSource(t, "service.go")
	body := functionBody(service, "func (s *Service) DeleteSupplier(")
	if body == "" {
		t.Fatal("DeleteSupplier not found")
	}

	check := strings.Index(body, "SupplierHistoryReferences(")
	softDelete := strings.Index(body, `"deleted_at"`)
	if check == -1 {
		t.Fatal("DeleteSupplier must check SupplierHistoryReferences: the menu promises delete only " +
			"happens when nothing references the supplier")
	}
	if softDelete != -1 && check > softDelete {
		t.Error("DeleteSupplier soft-deletes before checking history, so the check can never stop it")
	}
	if !strings.Contains(body, `"supplier_has_history"`) {
		t.Error("the refusal must carry reason supplier_has_history so the frontend's history-conflict " +
			"handling (isHistoryDeleteConflict matches *_has_history) recognises it")
	}

	// Every table that records purchasing against a supplier must be checked.
	// Missing one lets exactly that kind of history be orphaned.
	repository := readSource(t, "repository.go")
	references := functionBody(repository, "func (r *Repository) SupplierHistoryReferences(")
	for _, table := range []string{
		"purchase_orders", "purchase_receipts", "purchase_invoices",
		"purchase_invoice_payments", "supplier_payments", "purchase_returns",
		"counterparty_opening_balances",
	} {
		if !strings.Contains(references, "FROM "+table+" ") {
			t.Errorf("SupplierHistoryReferences does not check %s, so a supplier with only that history "+
				"could still be deleted", table)
		}
	}
}

// Every column the history check queries must exist.
//
// A misspelled column does not fail the build. It fails at runtime, on every
// call, and turns "delete a supplier" into a 500 for all suppliers -- the same
// shape as ISSUE-011, where customer statistics failed for every customer on
// every request with nothing in the build to object. So the columns are checked
// against the migrations that create them.
func TestSupplierHistoryQueriesUseRealColumns(t *testing.T) {
	repository := readSource(t, "repository.go")
	references := functionBody(repository, "func (r *Repository) SupplierHistoryReferences(")
	if references == "" {
		t.Fatal("SupplierHistoryReferences not found")
	}

	migrations := readMigrations(t)
	query := regexp.MustCompile(`FROM (\w+) WHERE ([^"]+)"`)
	column := regexp.MustCompile(`\b([a-z_]+)\s*(?:=|IS)`)

	matches := query.FindAllStringSubmatch(references, -1)
	if len(matches) == 0 {
		t.Fatal("no queries parsed from SupplierHistoryReferences; the check would pass vacuously")
	}
	for _, match := range matches {
		table, predicate := match[1], match[2]
		definition := tableDefinition(migrations, table)
		if definition == "" {
			t.Errorf("no migration creates table %s", table)
			continue
		}
		for _, col := range column.FindAllStringSubmatch(predicate, -1) {
			if !regexp.MustCompile(`\b` + col[1] + `\b`).MatchString(definition) {
				t.Errorf("%s has no column %s, so every supplier delete would fail at runtime", table, col[1])
			}
		}
	}
}

func readSource(t *testing.T, name string) string {
	t.Helper()
	raw, err := os.ReadFile(name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}

func functionBody(source, marker string) string {
	start := strings.Index(source, marker)
	if start == -1 {
		return ""
	}
	rest := source[start+len(marker):]
	end := len(rest)
	for _, stop := range []string{"\nfunc ", "\ntype "} {
		if i := strings.Index(rest, stop); i != -1 && i < end {
			end = i
		}
	}
	return rest[:end]
}

func readMigrations(t *testing.T) string {
	t.Helper()
	files, err := filepath.Glob("../../../migrations/*.sql")
	if err != nil || len(files) == 0 {
		t.Fatalf("no migrations found: %v", err)
	}
	var all strings.Builder
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		all.WriteString(strings.ReplaceAll(string(raw), "\r\n", "\n"))
		all.WriteString("\n")
	}
	return all.String()
}

// tableDefinition returns the CREATE TABLE block for a table plus every ALTER
// TABLE statement against it, since columns are often added later.
func tableDefinition(migrations, table string) string {
	var definition strings.Builder
	create := regexp.MustCompile(`(?s)CREATE TABLE IF NOT EXISTS ` + table + ` \(.*?\n\);`)
	definition.WriteString(create.FindString(migrations))
	alter := regexp.MustCompile(`(?m)^ALTER TABLE ` + table + `\b[^;]*;`)
	for _, statement := range alter.FindAllString(migrations, -1) {
		definition.WriteString("\n" + statement)
	}
	return definition.String()
}
