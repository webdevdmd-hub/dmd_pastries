package businesses

import (
	"os"
	"strings"
	"testing"
)

// businesses.status has accepted active / inactive / suspended since the first
// migration and superadmin could already set it, but nothing read it: a
// suspended workspace kept working exactly as before. T-V makes the status
// mean something and gives an owner a way to close their own workspace.
//
// These are structural: they hold the shape of a guard whose failure mode is
// silent (status set, nothing happens) or catastrophic (wrong person closes a
// workspace only support can reopen). The behaviour itself is checked live.
func TestCloseIsOwnerOnlyAndConfirmationGated(t *testing.T) {
	fn := functionSource(t, "service.go", "func (s *Service) CloseBusiness(")

	if !strings.Contains(fn, "OwnerUserID") {
		t.Error("CloseBusiness does not check ownership; settings-manage alone would be " +
			"enough to close a workspace that only a platform admin can reopen")
	}
	if !strings.Contains(fn, "req.Confirmation") {
		t.Error("CloseBusiness does not require a typed confirmation")
	}
	if !strings.Contains(fn, "business.BusinessName") {
		t.Error("confirmation should be the workspace name, not a yes/no the user can click through")
	}
	if !strings.Contains(fn, `"inactive"`) {
		t.Error("closing should set status to inactive")
	}
	// Nothing may be deleted: closing is reversible by design, which is the
	// whole reason it is allowed from inside the business at all.
	for _, forbidden := range []string{"Delete(", "Unscoped(", "DROP", "TRUNCATE"} {
		if strings.Contains(fn, forbidden) {
			t.Errorf("CloseBusiness must not delete anything, found %q", forbidden)
		}
	}
	if !strings.Contains(fn, "business.closed") {
		t.Error("closure must be audited: after it, the owner cannot sign in to explain what happened")
	}
}

// The generic settings PATCH must not be able to close a workspace as a side
// effect of a profile edit.
func TestGenericBusinessUpdateCannotChangeStatus(t *testing.T) {
	fn := functionSource(t, "service.go", "func (s *Service) UpdateBusiness(")
	if strings.Contains(fn, `updates["status"]`) {
		t.Error("UpdateBusiness writes status again; it needs only settings-manage, so any " +
			"settings manager could close the workspace while editing the business name")
	}

	dto, err := os.ReadFile("dto.go")
	if err != nil {
		t.Fatalf("read dto.go: %v", err)
	}
	req := functionSourceIn(string(dto), "type UpdateBusinessRequest struct {")
	if strings.Contains(req, "Status") {
		t.Error("UpdateBusinessRequest still carries Status; closing has its own owner-only route")
	}
}

func functionSource(t *testing.T, file, signature string) string {
	t.Helper()
	source, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read %s: %v", file, err)
	}
	body := functionSourceIn(string(source), signature)
	if body == "" {
		t.Fatalf("%s not found in %s", signature, file)
	}
	return body
}

func functionSourceIn(source, signature string) string {
	start := strings.Index(source, signature)
	if start == -1 {
		return ""
	}
	rest := source[start+len(signature):]
	end := strings.Index(rest, "\nfunc ")
	if end == -1 {
		if e := strings.Index(rest, "\n}\n"); e != -1 {
			return rest[:e]
		}
		return rest
	}
	return rest[:end]
}
