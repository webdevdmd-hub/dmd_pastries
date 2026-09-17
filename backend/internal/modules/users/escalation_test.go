package users

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-056 — anyone who could manage staff could hand out any
// role. Found by code review on 2026-09-17: the default Manager role holds
// users.create / users.edit / users.status.update, and no path compared the
// role being given, or the colleague being changed, with the caller's access.
// Owner decision: you can only give or act on a role you fully hold.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md

func usersFunctionBody(t *testing.T, marker string) string {
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

func requireBefore(t *testing.T, fn, guard, action string) {
	t.Helper()
	body := usersFunctionBody(t, "func (s *Service) "+fn+"(")
	g, a := strings.Index(body, guard), strings.Index(body, action)
	if g == -1 || a == -1 || g > a {
		t.Errorf("%s must call %s before %s", fn, guard, action)
	}
}

func TestGivingARoleRequiresHoldingIt(t *testing.T) {
	requireBefore(t, "CreateUser", "s.ensureCanGrantRole(currentUser, role)", "s.repo.Create(tx, user)")
	requireBefore(t, "InviteUser", "s.ensureCanGrantRole(currentUser, role)", "s.identities.CreateUser(")
	requireBefore(t, "CreateInvitation", "s.ensureCanGrantRole(currentUser, role)", "s.repo.CreateInvitation(tx, invite)")
	requireBefore(t, "UpdateUser", "s.ensureCanGrantRole(currentUser, role)", `updates["role_id"] = role.ID`)
	// A resent link goes to the caller, who could accept it themselves.
	requireBefore(t, "ResendInvitation", "s.ensureCanGrantInvitationRole(currentUser, invite)", "generateInvitationToken()")
	requireBefore(t, "CancelInvitation", "s.ensureCanGrantInvitationRole(currentUser, invite)", "s.repo.UpdateInvitation(")
}

func TestColleaguesAboveYouCannotBeChanged(t *testing.T) {
	requireBefore(t, "UpdateUser", "s.ensureCanManageUser(currentUser, user)", "s.repo.UpdateByBusinessIDTx(")
	requireBefore(t, "UpdateUserStatus", "s.ensureCanManageUser(currentUser, user)", "s.repo.UpdateByBusinessID(")
	requireBefore(t, "DeleteUser", "s.ensureCanManageUser(currentUser, user)", "s.repo.SoftDeleteByBusinessID(")
	requireBefore(t, "RestoreUser", "s.ensureCanManageUser(currentUser, user)", "s.repo.RestoreByBusinessID(")
	requireBefore(t, "AssignUserBranch", "s.ensureCanManageUser(currentUser, user)", "tx := s.db.Begin()")
	// A reset link is as good as the password.
	requireBefore(t, "CreatePasswordResetLink", "s.ensureCanManageUser(currentUser, user)", "s.identities.CreatePasswordResetToken(")
}

// Deleting refused the owner and the last admin; suspending or re-roling them
// did not, which locked the business out just the same.
func TestTheOwnerAndLastAdminKeepAccess(t *testing.T) {
	requireBefore(t, "UpdateUserStatus", "s.ensureAccessKept(currentUser, user, req.Status, nil)", "s.repo.UpdateByBusinessID(")
	requireBefore(t, "UpdateUser", "s.ensureAccessKept(currentUser, user, \"\", role)", `updates["role_id"] = role.ID`)

	raw, err := os.ReadFile("escalation.go")
	if err != nil {
		t.Fatal(err)
	}
	guard := strings.ReplaceAll(string(raw), "\r\n", "\n")
	for _, want := range []string{
		"*business.OwnerUserID == user.ID",
		"s.repo.CountActiveAdmins(currentUser.BusinessID)",
		`newStatus != "" && newStatus != "active"`,
		"permissions.UncoveredPermissions(currentUser.Permissions, keys)",
	} {
		if !strings.Contains(guard, want) {
			t.Errorf("escalation.go must contain %q", want)
		}
	}
}
