package users

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"pastries-pos/internal/shared/userhistory"
)

// Regression: ISSUE-075 — Staff > Delete hid the row and banned the Supabase
// login for ~100 years, so the login kept the person's email and phone:
// re-adding them failed with "a user already exists with this email or
// phone" while the Staff list showed nobody, and there was no Restore. Delete
// now always removes the login, and erases the staff record too when the
// person left no history the business must keep.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

// serviceFuncBody returns one method of service.go, normalised to LF, so an
// assertion cannot be satisfied by code in a neighbouring function.
func serviceFuncBody(t *testing.T, signature string) string {
	t.Helper()
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	src := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(src, signature)
	if start < 0 {
		t.Fatalf("%s not found", signature)
	}
	body := src[start:]
	if end := strings.Index(body[1:], "\nfunc "); end >= 0 {
		body = body[:end+1]
	}
	return body
}

// in-order asserts each needle appears, each after the previous one.
func inOrder(t *testing.T, body string, needles ...string) {
	t.Helper()
	at := 0
	for _, needle := range needles {
		index := strings.Index(body[at:], needle)
		if index < 0 {
			t.Fatalf("expected %q after position %d", needle, at)
		}
		at += index + len(needle)
	}
}

func TestDeleteUserRemovesTheLoginAndErasesWhenThereIsNoHistory(t *testing.T) {
	body := serviceFuncBody(t, "func (s *Service) DeleteUser(")

	if strings.Contains(body, "SetUserStatus(") {
		t.Fatal("DeleteUser still only locks the login; it must remove it")
	}
	inOrder(t, body,
		"userhistory.Has(s.db, user.ID)",
		"s.db.Begin()",
		"if !hasHistory {",
		"s.repo.HardDeleteByBusinessID(tx, user.ID, currentUser.BusinessID)",
		"if !erased {",
		"s.repo.SoftDeleteByBusinessID(tx, user.ID, currentUser.BusinessID)",
		"s.repo.ClearProviderIDs(tx, user.ID)",
		"s.identities.DeleteUser(user.ProviderIDs())",
		"tx.Rollback()",
		"tx.Commit()",
	)
}

func TestRestoreRefusesAUserWhoseLoginWasRemoved(t *testing.T) {
	body := serviceFuncBody(t, "func (s *Service) RestoreUser(")
	inOrder(t, body, "if !user.ProviderIDs().HasLogin() {", "apperrors.Conflict(", "s.db.Begin()")
}

// Audit rows name every account from the moment it is created (its own
// "Created User", its logins). Counting them as history made hard delete
// impossible for any real user; they carry no foreign key to users.
func TestAuditRowsAreNotHistory(t *testing.T) {
	for _, ref := range userhistory.References() {
		if strings.Contains(ref.Table, "audit") {
			t.Fatalf("%s is on the history list; audit rows must not block erasing a user", ref.Table)
		}
	}
	tables := map[string]bool{}
	for _, ref := range userhistory.References() {
		tables[ref.Table] = true
	}
	for _, must := range []string{"sales", "sale_payments", "bakery_orders", "journal_entries", "stock_movements", "purchase_invoices"} {
		if !tables[must] {
			t.Errorf("%s is missing from the history list: a user who rang up or posted one would be erased", must)
		}
	}
}

func TestOnlyAForeignKeyViolationFallsBackToKeepingTheRecord(t *testing.T) {
	if !isForeignKeyViolation(fmt.Errorf("delete: %w", &pgconn.PgError{Code: "23503"})) {
		t.Fatal("a foreign key violation (23503) must fall back to keeping the record")
	}
	if isForeignKeyViolation(&pgconn.PgError{Code: "23505"}) {
		t.Fatal("other database errors must fail the delete, not silently keep the record")
	}
	if isForeignKeyViolation(errors.New("connection reset")) {
		t.Fatal("a non-database error must fail the delete")
	}
}
