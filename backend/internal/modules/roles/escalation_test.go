package roles

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-056 — a Manager could add any permission to any role,
// their own included. Owner decision 2026-09-17: grant only what you hold,
// change only roles within your access, never your own role's permissions.

func rolesFunctionBody(t *testing.T, marker string) string {
	t.Helper()
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(source, marker)
	if start == -1 {
		t.Fatalf("%s not found", marker)
	}
	rest := source[start+len(marker):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}

func guardBefore(t *testing.T, fn, guard, action string) {
	t.Helper()
	body := rolesFunctionBody(t, "func (s *Service) "+fn+"(")
	g, a := strings.Index(body, guard), strings.Index(body, action)
	if g == -1 || a == -1 || g > a {
		t.Errorf("%s must call %s before %s", fn, guard, action)
	}
}

func TestRoleChangesStayWithinTheEditorsAccess(t *testing.T) {
	guardBefore(t, "CreateRole", "grantingBeyondAccess(currentUser, normalizedKeys)", "s.repo.Create(tx, role)")
	guardBefore(t, "UpdateRole", "s.ensureCanChangeRole(currentUser, role, req.PermissionKeys != nil)", "s.repo.Update(tx, roleID, updates)")
	guardBefore(t, "UpdateRole", "grantingBeyondAccess(currentUser, normalizedKeys)", "s.repo.ReplacePermissions(")
	guardBefore(t, "UpdateRolePermissions", "s.ensureCanChangeRole(currentUser, role, true)", "s.repo.ReplacePermissions(")
	guardBefore(t, "UpdateRolePermissions", "grantingBeyondAccess(currentUser, normalizedKeys)", "s.repo.ReplacePermissions(")
	guardBefore(t, "DeleteRole", "s.ensureCanChangeRole(currentUser, role, false)", "s.repo.Delete(tx, roleID)")

	raw, err := os.ReadFile("escalation.go")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(strings.ReplaceAll(string(raw), "\r\n", "\n"), "if changesPermissions && role.ID == currentUser.RoleID {") {
		t.Error("an editor must not change their own role's permissions")
	}
}
