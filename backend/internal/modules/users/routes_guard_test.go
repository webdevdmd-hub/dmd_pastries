package users

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// Issuing a password reset link is as powerful as knowing the password. The
// route must sit behind the users-edit permission, inside the authenticated
// group. This reads routes.go rather than mounting the router because the
// permission middlewares are injected by main.go; what is being protected
// is the wiring, and the wiring is text.
func TestPasswordResetLinkRouteRequiresUsersEdit(t *testing.T) {
	source, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}

	route := regexp.MustCompile(`group\.POST\("/:id/password-reset-link",\s*usersEdit,\s*handler\.CreatePasswordResetLink\)`)
	if !route.Match(source) {
		t.Fatal("POST /:id/password-reset-link is not registered with the usersEdit permission")
	}
	// It must be registered on the /api/v1/users group (which carries
	// authGuard), not on the public auth group.
	public := regexp.MustCompile(`(?s)func RegisterPublicAuthRoutes.*password-reset-link`)
	if public.Match(source) {
		t.Fatal("the reset-link route is registered on the public, unauthenticated group")
	}
}

// funcBody returns the source of one top-level function, so an assertion
// about "this function calls X" cannot be satisfied by a call in a later
// function. A (?s).*? regex in RE2 walks straight across function
// boundaries; this does not. The first version of these guards had exactly
// that hole and passed with the call removed.
func funcBody(t *testing.T, source []byte, signature string) string {
	t.Helper()
	src := string(source)
	start := strings.Index(src, signature)
	if start < 0 {
		t.Fatalf("%s not found", signature)
	}
	rest := src[start+len(signature):]
	if end := strings.Index(rest, "\nfunc "); end >= 0 {
		return rest[:end]
	}
	return rest
}

func readSource(t *testing.T, path string) []byte {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return source
}

// A reset request is a tag that must come off once it has been answered.
// Two things answer it: a manager issuing the link, and the user signing in.
// Both are asserted as calls inside their own function, so a refactor that
// drops either one fails here instead of leaving stale "reset requested"
// tags on the Staff page forever.
func TestAnsweringAResetRequestClearsTheTag(t *testing.T) {
	users := readSource(t, "service.go")
	if !strings.Contains(funcBody(t, users, "func (s *Service) CreatePasswordResetLink("), "s.repo.ClearPasswordResetRequest(") {
		t.Error("CreatePasswordResetLink no longer clears password_reset_requested_at")
	}

	auth := readSource(t, "../auth/service.go")
	if !strings.Contains(funcBody(t, auth, "func (s *Service) syncProfile("), "s.userRepo.ClearPasswordResetRequest(") {
		t.Error("syncProfile (login) no longer clears password_reset_requested_at")
	}
}

// Public endpoints change data from a browser that is not signed in, so no
// tab can announce the change to the business's other tabs; the service
// must. Each site is asserted inside its own function body.
func TestPublicEndpointsAnnounceTheirChanges(t *testing.T) {
	users := readSource(t, "service.go")
	if !strings.Contains(
		funcBody(t, users, "func (s *Service) AcceptInvitation("),
		`sharedevents.Announce(s.events, invite.BusinessID, "users", "invitations")`,
	) {
		t.Error("AcceptInvitation no longer announces users+invitations to the inviter's open tabs")
	}

	auth := readSource(t, "../auth/service.go")
	if !strings.Contains(
		funcBody(t, auth, "func (s *Service) RequestAdminPasswordReset("),
		`sharedevents.Announce(s.events, user.BusinessID, "users")`,
	) {
		t.Error("RequestAdminPasswordReset no longer announces -- the manager's Staff page will not update until reload")
	}
	if !strings.Contains(
		funcBody(t, auth, "func (s *Service) syncProfile("),
		`sharedevents.Announce(s.events, user.BusinessID, "users")`,
	) {
		t.Error("a sign-in that clears a reset request no longer announces it")
	}
}
