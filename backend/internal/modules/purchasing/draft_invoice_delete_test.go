package purchasing

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Regression: ISSUE-025 — a draft bill could never be removed.
//
// CancelInvoice refuses a draft: "draft purchase invoices should be deleted, not
// cancelled". But there was no delete: no route, no service method, no menu
// item. Found on production on 2026-09-15 creating draft QA-DUE-TERMS-1 to
// verify ISSUE-022: its menu offered Edit and Post only. A draft entered by
// mistake stayed forever, and a draft converted from a purchase order blocked
// that order from being billed again, because ActiveInvoiceCountForOrder
// counts drafts.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestDraftBillsCanBeDeletedAsCancelPromises(t *testing.T) {
	service := purchasingSource(t, "service.go")
	routes := purchasingSource(t, "routes.go")

	if strings.Contains(functionBody(service, "func (s *Service) CancelInvoice("), "should be deleted") &&
		!strings.Contains(routes, `group.DELETE("/invoices/:id"`) {
		t.Fatal("CancelInvoice tells the user to delete a draft bill, but no DELETE /invoices/:id route exists")
	}

	body := functionBody(service, "func (s *Service) DeleteInvoice(")
	if body == "" {
		t.Fatal("DeleteInvoice not found")
	}
	statusCheck := strings.Index(body, `invoice.Status != "draft"`)
	referenceCheck := strings.Index(body, "InvoiceReferenceCount(")
	hardDelete := strings.Index(body, "HardDeleteDraftInvoice(")
	switch {
	case statusCheck == -1:
		t.Error("DeleteInvoice must refuse anything but a draft; a posted bill carries a payable and a journal")
	case referenceCheck == -1:
		t.Error("DeleteInvoice must check InvoiceReferenceCount before deleting")
	case hardDelete == -1:
		t.Error("DeleteInvoice must call HardDeleteDraftInvoice")
	case statusCheck > hardDelete || referenceCheck > hardDelete:
		t.Error("DeleteInvoice deletes before its checks, so the checks can never stop it")
	}

	repository := purchasingSource(t, "repository.go")
	deleteBody := functionBody(repository, "func (r *Repository) HardDeleteDraftInvoice(")
	if !strings.Contains(deleteBody, `status = ?", invoiceID, businessID, "draft"`) {
		t.Error("HardDeleteDraftInvoice must repeat the draft guard in the DELETE itself, so a bill posted " +
			"between the check and the delete is never removed")
	}
}

// Every table with a foreign key to purchase_invoices must be checked before a
// draft is deleted. Read from the migrations, so a table added later that points
// at bills fails here instead of being orphaned in production.
func TestDraftBillDeleteChecksEveryTableThatReferencesBills(t *testing.T) {
	migrations := purchasingMigrations(t)

	create := regexp.MustCompile(`(?s)CREATE TABLE IF NOT EXISTS (\w+) \((.*?)\n\);`)
	referencing := map[string]bool{}
	for _, match := range create.FindAllStringSubmatch(migrations, -1) {
		if regexp.MustCompile(`REFERENCES purchase_invoices\s*\(id\)`).MatchString(match[2]) {
			referencing[match[1]] = true
		}
	}
	alter := regexp.MustCompile(`(?s)ALTER TABLE (?:IF EXISTS )?(\w+)[^;]*REFERENCES purchase_invoices\s*\(id\)`)
	for _, match := range alter.FindAllStringSubmatch(migrations, -1) {
		referencing[match[1]] = true
	}
	delete(referencing, "purchase_invoice_items") // the bill's own lines, deleted with it
	if len(referencing) == 0 {
		t.Fatal("no tables referencing purchase_invoices found; the migration parse is broken")
	}

	checked := map[string]bool{}
	for _, table := range invoiceReferenceTables {
		checked[table] = true
	}
	for table := range referencing {
		if !checked[table] {
			t.Errorf("%s references purchase_invoices but InvoiceReferenceCount does not check it, so a draft "+
				"bill it points at could be deleted out from under it", table)
		}
	}

	// InvoiceReferenceCount filters every table on these two columns. A table
	// without one fails at runtime, on every delete.
	for _, table := range invoiceReferenceTables {
		block := regexp.MustCompile(`(?s)CREATE TABLE IF NOT EXISTS ` + table + ` \((.*?)\n\);`).FindStringSubmatch(migrations)
		if block == nil {
			t.Errorf("no migration creates %s", table)
			continue
		}
		for _, column := range []string{"business_id", "purchase_invoice_id"} {
			if !regexp.MustCompile(`\b` + column + `\b`).MatchString(block[1]) {
				t.Errorf("%s has no %s column, so every draft bill delete would fail", table, column)
			}
		}
	}
}

func purchasingSource(t *testing.T, name string) string {
	t.Helper()
	raw, err := os.ReadFile(name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}

func purchasingMigrations(t *testing.T) string {
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
