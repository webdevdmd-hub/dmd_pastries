package utils

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"pastries-pos/internal/config"
)

// supabaseSpy records the calls a manager makes to Supabase and lets a test
// force a failure, so the compensation path can be exercised.
type supabaseSpy struct {
	mu       sync.Mutex
	paths    []string
	methods  []string
	failNext bool
}

func (s *supabaseSpy) client(t *testing.T) *SupabaseAdminClient {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.paths = append(s.paths, r.URL.Path)
		s.methods = append(s.methods, r.Method)
		shouldFail := s.failNext
		s.mu.Unlock()

		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")

		if shouldFail {
			w.WriteHeader(http.StatusUnprocessableEntity)
			_, _ = w.Write([]byte(`{"msg":"A user with this email address has already been registered"}`))
			return
		}
		_, _ = w.Write([]byte(`{"id":"bbbbbbbb-0000-4000-8000-000000000002","access_token":"session"}`))
	}))
	t.Cleanup(server.Close)

	client := NewSupabaseAdminClient(config.Config{
		SupabaseURL:            "https://examplerefnotreal01.supabase.co",
		SupabaseServiceRoleKey: "service-role-not-real",
		AppEnv:                 "production",
	})
	client.baseURL = server.URL
	return client
}

func (s *supabaseSpy) called(path string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, seen := range s.paths {
		if strings.HasPrefix(seen, path) {
			return true
		}
	}
	return false
}

// e2e mode makes AppwriteClient return deterministic ids without a network
// call, which is enough to exercise the manager's coordination.
func fakeAppwrite() *AppwriteClient {
	return NewAppwriteClient(config.Config{AppEnv: "e2e", E2EAuthToken: "token"})
}

func TestCreateUserWritesToBothProvidersWhileBothAreLive(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(fakeAppwrite(), spy.client(t), primaryAppwrite)

	ids, err := manager.CreateUser("staff@test.invalid", "hunter2hunter2", "Staff", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	if ids.Appwrite == "" {
		t.Error("no Appwrite id; users.appwrite_user_id is NOT NULL and the insert would fail")
	}
	if ids.Supabase == "" {
		t.Error("no Supabase id; an employee hired now could not sign in after cutover")
	}
	if !spy.called("/admin/users") {
		t.Error("Supabase was never asked to create the account")
	}
}

// The reason both writes are coordinated rather than fired independently: a
// half-created identity cannot be retried, because the retry hits "already
// exists" in the provider that succeeded.
func TestCreateUserRollsBackAppwriteWhenSupabaseRejects(t *testing.T) {
	spy := &supabaseSpy{failNext: true}
	manager := NewIdentityManager(fakeAppwrite(), spy.client(t), primaryAppwrite)

	ids, err := manager.CreateUser("staff@test.invalid", "hunter2hunter2", "Staff", "")
	if err == nil {
		t.Fatal("CreateUser reported success though Supabase rejected the account")
	}
	if ids.Appwrite != "" || ids.Supabase != "" {
		t.Errorf("ids leaked from a failed creation: %+v", ids)
	}

	message, _ := FriendlyCreateUserError(err)
	if !strings.Contains(message, "already exists") {
		t.Errorf("message = %q, want Supabase's own reason surfaced", message)
	}
}

// Before cutover the Supabase half is unconfigured. Creation must still work
// and must not invent a Supabase id, or the partial unique index will reject
// the second user.
func TestCreateUserIsAppwriteOnlyBeforeCutover(t *testing.T) {
	manager := NewIdentityManager(fakeAppwrite(), NewSupabaseAdminClient(config.Config{}), primaryAppwrite)

	ids, err := manager.CreateUser("staff@test.invalid", "hunter2hunter2", "Staff", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if ids.Appwrite == "" {
		t.Error("no Appwrite id")
	}
	if ids.Supabase != "" {
		t.Errorf("invented a Supabase id (%q) with no Supabase configured", ids.Supabase)
	}
	if ids.SupabaseOrNil() != nil {
		t.Error("SupabaseOrNil must be nil so the column stays NULL")
	}
}

// A deactivated employee must be blocked everywhere. Leaving one provider
// enabled means they can still sign in through it, and dual-verify accepts the
// resulting token.
func TestSetUserStatusAppliesToEveryProvider(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(fakeAppwrite(), spy.client(t), primaryAppwrite)

	ids := ProviderIDs{Appwrite: "appwrite-id", Supabase: "bbbbbbbb-0000-4000-8000-000000000002"}
	if err := manager.SetUserStatus(ids, false); err != nil {
		t.Fatalf("SetUserStatus: %v", err)
	}
	if !spy.called("/admin/users/bbbbbbbb") {
		t.Error("Supabase was not told to block sign-in")
	}
}

// Recovery has to come from the provider that issues sessions, or the link a
// user clicks belongs to a system they are not signing in to.
func TestPasswordRecoveryFollowsThePrimaryProvider(t *testing.T) {
	t.Run("appwrite primary", func(t *testing.T) {
		spy := &supabaseSpy{}
		manager := NewIdentityManager(fakeAppwrite(), spy.client(t), primaryAppwrite)

		if err := manager.CreatePasswordRecovery("staff@test.invalid", "https://app.example/reset"); err != nil {
			t.Fatalf("CreatePasswordRecovery: %v", err)
		}
		if spy.called("/recover") {
			t.Error("Supabase sent the reset email while Appwrite is primary")
		}
	})

	t.Run("supabase primary", func(t *testing.T) {
		spy := &supabaseSpy{}
		manager := NewIdentityManager(fakeAppwrite(), spy.client(t), primarySupabase)

		if err := manager.CreatePasswordRecovery("staff@test.invalid", "https://app.example/reset"); err != nil {
			t.Fatalf("CreatePasswordRecovery: %v", err)
		}
		if !spy.called("/recover") {
			t.Error("Supabase is primary but did not send the reset email")
		}
	})
}

// An unconfigured Supabase must not become primary just because an env var says
// so, or password resets would silently stop being sent.
func TestPrimaryFallsBackWhenSupabaseIsNotConfigured(t *testing.T) {
	manager := NewIdentityManager(fakeAppwrite(), NewSupabaseAdminClient(config.Config{}), primarySupabase)

	if manager.PrimaryIsSupabase() {
		t.Error("PrimaryIsSupabase is true with no Supabase configuration")
	}
}

// Both link shapes have to work at once so the reset page can migrate on its
// own schedule rather than in the same deploy.
func TestCompleteRecoveryAcceptsEitherProvidersProof(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(fakeAppwrite(), spy.client(t), primaryAppwrite)

	if err := manager.CompletePasswordRecovery("", "", "supabase-token", "newpassword123"); err != nil {
		t.Fatalf("token form: %v", err)
	}
	if !spy.called("/verify") {
		t.Error("a token-bearing reset did not go to Supabase")
	}

	if err := manager.CompletePasswordRecovery("appwrite-user", "secret", "", "newpassword123"); err != nil {
		t.Fatalf("id+secret form: %v", err)
	}

	if err := manager.CompletePasswordRecovery("", "", "", "newpassword123"); err == nil {
		t.Error("a reset carrying no proof of identity was accepted")
	}
}

func TestJSONShapeOfProviderIDsStaysNullWhenEmpty(t *testing.T) {
	encoded, err := json.Marshal(struct {
		SupabaseUserID *string `json:"supabase_user_id,omitempty"`
	}{SupabaseUserID: ProviderIDs{Appwrite: "a"}.SupabaseOrNil()})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if string(encoded) != "{}" {
		t.Errorf("encoded = %s, want the field omitted entirely", encoded)
	}
}
