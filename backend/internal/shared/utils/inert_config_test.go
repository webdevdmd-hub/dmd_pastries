package utils

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pastries-pos/internal/config"
)

// What actually happens when the Supabase environment variables are set but
// neither provider flag is flipped.
//
// The whole migration rests on that state being safe to enter days before the
// cutover, so it is worth knowing exactly -- not approximately -- what changes
// the moment those variables land in Dokploy.
func configuredButNotPrimary() config.Config {
	return config.Config{
		SupabaseURL:            "https://examplerefnotreal01.supabase.co",
		SupabaseJWTSecret:      "test-jwt-secret-not-a-real-one",
		SupabaseServiceRoleKey: "service-role-not-real",
		AuthPrimaryProvider:    "appwrite", // the default; nothing has been flipped
		AppEnv:                 "production",
	}
}

// Appwrite tokens keep taking the Appwrite path, because a token names its own
// issuer and an Appwrite one never claims to be Supabase.
func TestTokenVerificationIsUnaffectedByConfiguringSupabase(t *testing.T) {
	verifier := NewSupabaseVerifier(configuredButNotPrimary())

	if !verifier.Configured() {
		t.Fatal("the verifier should be configured; that is the state being tested")
	}
	if verifier.OwnsToken("an.appwrite.jwt") {
		t.Error("the Supabase verifier claimed an Appwrite token, which would send " +
			"every existing session down the wrong path")
	}
}

// Password reset emails keep coming from Appwrite, so a link a user clicks
// still belongs to the system they sign in to.
func TestPasswordResetStaysWithAppwriteUntilPrimaryFlips(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(fakeAppwrite(), spy.client(t), "appwrite")

	if manager.PrimaryIsSupabase() {
		t.Error("Supabase became primary merely by being configured")
	}
	if err := manager.CreatePasswordRecovery("staff@test.invalid", "https://app.example/reset"); err != nil {
		t.Fatalf("CreatePasswordRecovery: %v", err)
	}
	if spy.called("/recover") {
		t.Error("Supabase sent the reset email while Appwrite is still primary")
	}
}

// The one thing that DOES change, and it is deliberate.
//
// Configuring Supabase makes account creation write to both providers, before
// any flag is flipped. That is the design -- an employee hired during the
// dual-run window must be able to sign in if the cutover is rolled back, and
// users.appwrite_user_id is NOT NULL so a Supabase-only account has nothing to
// put there.
//
// It is asserted here because "setting the variables changes nothing" is the
// natural assumption and it is wrong. From that moment, creating a staff user
// depends on Supabase being reachable: if it rejects the account the whole
// creation fails, having rolled the Appwrite half back. Worth knowing before
// the first person tries to add an employee, rather than after.
func TestConfiguringSupabaseStartsDualWritingAccounts(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(fakeAppwrite(), spy.client(t), "appwrite")

	ids, err := manager.CreateUser("newhire@test.invalid", "hunter2hunter2", "New Hire", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	if ids.Appwrite == "" {
		t.Error("no Appwrite id")
	}
	if ids.Supabase == "" {
		t.Error("no Supabase id: an employee hired now could not sign in after cutover")
	}
	if !spy.called("/admin/users") {
		t.Error("Supabase was not asked to create the account")
	}
}

// And the corollary: an unreachable Supabase now fails user creation outright,
// rather than being ignored. Deliberate -- a half-created identity cannot be
// retried, because the retry hits "already exists" in the provider that
// succeeded -- but it is a new dependency the moment the variables are set.
func TestAnUnreachableSupabaseFailsAccountCreation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"msg":"database is down"}`))
	}))
	t.Cleanup(server.Close)

	client := NewSupabaseAdminClient(configuredButNotPrimary())
	client.baseURL = server.URL

	_, err := NewIdentityManager(fakeAppwrite(), client, "appwrite").
		CreateUser("newhire@test.invalid", "hunter2hunter2", "New Hire", "")

	if err == nil {
		t.Fatal("account creation succeeded while Supabase was failing, which would " +
			"leave the new user missing from Supabase and unable to sign in after cutover")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "database is down") {
		t.Errorf("err = %v, want Supabase's own reason surfaced", err)
	}
}
