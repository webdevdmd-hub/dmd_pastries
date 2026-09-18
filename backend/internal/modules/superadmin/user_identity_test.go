package superadmin

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-075 — the Super Admin user operations could not reach
// Supabase at all: soft delete left the login open, restore left a tenant
// delete's ban in place (the restored user still could not sign in), and hard
// delete orphaned the login with its email reserved forever. The hard-delete
// preview also counted audit rows, which every account has, so no real user
// could ever be hard-deleted.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func superadminSource(t *testing.T) string {
	t.Helper()
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}

func funcBody(t *testing.T, src, signature string) string {
	t.Helper()
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

func TestHardDeleteRemovesTheLoginBeforeCommitting(t *testing.T) {
	body := funcBody(t, superadminSource(t), "func (s *Service) hardDeleteUser(")
	login := strings.Index(body, "s.identities.DeleteUser(loginOf(before.User))")
	commit := strings.Index(body, "tx.Commit()")
	if login < 0 {
		t.Fatal("hard delete does not remove the user's login")
	}
	if commit < 0 || login > commit {
		t.Fatal("the login must be removed before the delete commits, so a refusal leaves the user intact")
	}
}

func TestSoftDeleteAndRestoreMoveTheLoginWithTheRow(t *testing.T) {
	body := funcBody(t, superadminSource(t), "func (s *Service) UpdateUserAction(")
	for _, want := range []string{
		"locked := false\n\t\t\tsetLoginEnabled = &locked",
		"if !loginOf(before.User).HasLogin() {",
		"unlocked := true\n\t\t\tsetLoginEnabled = &unlocked",
		"s.identities.SetUserStatus(loginOf(before.User), *setLoginEnabled)",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("UpdateUserAction is missing %q", want)
		}
	}
	status := strings.Index(body, "s.identities.SetUserStatus(")
	commit := strings.LastIndex(body, "tx.Commit()")
	if status < 0 || commit < 0 || status > commit {
		t.Error("the login must be locked or unlocked before the action commits")
	}
}

func TestHardDeletePreviewDoesNotCountAuditRows(t *testing.T) {
	for _, query := range hardDeleteBlockingQueries() {
		if strings.Contains(query.table, "audit") {
			t.Fatalf("%s blocks hard delete; every account has audit rows, so nobody could be erased", query.table)
		}
	}
	if len(hardDeleteBlockingQueries()) == 0 {
		t.Fatal("the blocking list is empty; users with sales would be erased")
	}
}
