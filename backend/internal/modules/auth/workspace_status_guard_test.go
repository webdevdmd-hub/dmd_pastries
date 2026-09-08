package auth

import (
	"os"
	"strings"
	"testing"
)

// businesses.status accepted active / inactive / suspended from migration
// 000001 and superadmin could set it, but no code path ever read it, so
// suspending a workspace changed a column and nothing else. Both auth paths
// now refuse a business that is not active, mirroring the inactive-user check
// that sits immediately above each one.
func TestBothAuthPathsRefuseAClosedWorkspace(t *testing.T) {
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	body := string(source)

	for _, fn := range []string{
		"func (s *Service) AuthenticateToken(",
		"func (s *Service) syncProfile(",
	} {
		start := strings.Index(body, fn)
		if start == -1 {
			t.Fatalf("%s not found", fn)
		}
		rest := body[start:]
		if end := strings.Index(rest[len(fn):], "\nfunc "); end != -1 {
			rest = rest[:len(fn)+end]
		}
		if !strings.Contains(rest, `business.Status != "active"`) {
			t.Errorf("%s does not refuse a non-active workspace; token checks and login "+
				"must agree, or a closed workspace stays reachable through one of them", fn)
		}
		if !strings.Contains(rest, "workspace_not_active") {
			t.Errorf("%s should return a structured reason so the client can show a "+
				"workspace-closed screen rather than a generic permission error", fn)
		}
	}

	// Platform admins return before either check. If that ever stops being
	// true, closing a business locks out the only people who can reopen it.
	adminIdx := strings.Index(body, "isSuperAdminIdentity")
	authIdx := strings.Index(body, `business.Status != "active"`)
	if adminIdx == -1 || authIdx == -1 || adminIdx > authIdx {
		t.Error("the platform-admin short-circuit must come before the workspace check")
	}
}
