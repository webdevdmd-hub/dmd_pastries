package auth

import (
	"os"
	"strings"
	"testing"
)

// The dual-verify bridge lets Appwrite and Supabase tokens both authenticate
// while the migration is in flight, so the cutover is reversible per client:
// point the frontend back at Appwrite and it works, with no data restore.
//
// These are structural, in the same style as the workspace-status guard next
// door, because the behaviour they protect needs a database to exercise and the
// failure modes are silent. Getting the resolution column wrong does not error
// -- it finds nobody, or worse, finds the wrong person.
func TestSupabaseIdentitiesResolveByTheirOwnColumn(t *testing.T) {
	fn := authFunctionSource(t, "func (s *Service) resolveLocalUserForIdentity(")

	supabaseBranch, _, found := strings.Cut(fn, "var user users.User")
	if !found {
		t.Fatal("resolveLocalUserForIdentity no longer has the shape this test reads")
	}

	if !strings.Contains(supabaseBranch, "IsSupabase()") {
		t.Error("resolveLocalUserForIdentity does not branch on the identity provider; " +
			"a Supabase subject would be looked up in appwrite_user_id and match nobody")
	}
	if !strings.Contains(supabaseBranch, `"supabase_user_id = ?"`) {
		t.Error("the Supabase branch does not resolve against supabase_user_id")
	}

	// The email fallback is the dangerous half. On the Appwrite path it
	// bootstraps users whose local row predates their provider account. On the
	// Supabase path it would relink the column on every login where the two
	// providers disagree, and would hand anyone who can register a Supabase
	// account with a staff address that person's business, role and permissions.
	for _, forbidden := range []string{"LOWER(email)", "UpdateAppwriteUserID", "provisionInvitedUserForIdentity"} {
		if strings.Contains(supabaseBranch, forbidden) {
			t.Errorf("the Supabase branch reaches %q; it must resolve by provider id only", forbidden)
		}
	}
}

// Both providers issue JWTs, so something has to decide which verifier gets the
// token. If that dispatch disappears, Supabase sessions get replayed to
// Appwrite's /account endpoint and every one of them fails.
func TestTokenVerificationIsDispatchedByProvider(t *testing.T) {
	fn := authFunctionSource(t, "func (s *Service) verifyIdentity(")

	if !strings.Contains(fn, "OwnsToken") {
		t.Error("verifyIdentity does not ask the Supabase verifier whether the token is its own")
	}
	if !strings.Contains(fn, "supabaseVerifier.VerifyToken") {
		t.Error("verifyIdentity never calls the Supabase verifier")
	}
	if !strings.Contains(fn, "appwriteClient.VerifyJWT") {
		t.Error("verifyIdentity dropped the Appwrite path; existing sessions would stop working")
	}

	// Both live call sites must go through the dispatcher, or one provider
	// silently stops working on one of the two entry points.
	// Two entry points take a bearer token: LoginSync and AuthenticateToken.
	source := authSource(t)
	if got := strings.Count(source, "s.verifyIdentity("); got < 2 {
		t.Errorf("only %d auth entry point(s) route through verifyIdentity, want both "+
			"LoginSync and AuthenticateToken", got)
	}
	if strings.Count(source, "s.appwriteClient.VerifyJWT(") != 1 {
		t.Error("appwriteClient.VerifyJWT should be reached only from verifyIdentity")
	}
}

// Platform admin is granted on an email match against an env allowlist. With
// Appwrite that email came from the server on every request; a Supabase JWT
// carries whatever it was minted with, and users can change their own address.
func TestSupabasePlatformAdminRequiresAConfirmedEmail(t *testing.T) {
	fn := authFunctionSource(t, "func (s *Service) isSuperAdminIdentity(")

	if !strings.Contains(fn, "IsSupabase()") || !strings.Contains(fn, "EmailVerified") {
		t.Error("isSuperAdminIdentity grants platform admin from an unverified Supabase email; " +
			"anyone who can register an allowlisted address becomes a platform admin")
	}

	verifiedGate := strings.Index(fn, "EmailVerified")
	allowlistLoop := strings.Index(fn, "range s.cfg.SuperAdminEmails")
	if verifiedGate == -1 || allowlistLoop == -1 || verifiedGate > allowlistLoop {
		t.Error("the confirmed-email check must come before the allowlist match")
	}
}

func authSource(t *testing.T) string {
	t.Helper()
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	return string(source)
}

func authFunctionSource(t *testing.T, signature string) string {
	t.Helper()
	source := authSource(t)

	start := strings.Index(source, signature)
	if start == -1 {
		t.Fatalf("%s not found in service.go", signature)
	}

	rest := source[start+len(signature):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}
