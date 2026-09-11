package users

import (
	"os"
	"regexp"
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

// A reset request is a tag that must come off once it has been answered.
// Two things answer it: a manager issuing the link, and the user signing in.
// Both are asserted as calls in the source, so a refactor that drops either
// one fails here instead of leaving stale "reset requested" tags on the
// Staff page forever.
func TestAnsweringAResetRequestClearsTheTag(t *testing.T) {
	users, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	link := regexp.MustCompile(`(?s)func \(s \*Service\) CreatePasswordResetLink\(.*?s\.repo\.ClearPasswordResetRequest\(`)
	if !link.Match(users) {
		t.Error("CreatePasswordResetLink no longer clears password_reset_requested_at")
	}

	auth, err := os.ReadFile("../auth/service.go")
	if err != nil {
		t.Fatalf("read auth/service.go: %v", err)
	}
	login := regexp.MustCompile(`(?s)func \(s \*Service\) syncProfile\(.*?s\.userRepo\.ClearPasswordResetRequest\(`)
	if !login.Match(auth) {
		t.Error("syncProfile (login) no longer clears password_reset_requested_at")
	}
}
