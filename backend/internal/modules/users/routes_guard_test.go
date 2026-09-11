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
