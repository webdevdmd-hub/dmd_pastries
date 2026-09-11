package utils

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"pastries-pos/internal/config"
)

// capture records what the client actually put on the wire. These tests are
// about the request, not the response: the failure mode being guarded is a
// wrong path, verb or field name, which a live call would report as a generic
// 4xx long after the fact.
type capture struct {
	method string
	path   string
	query  url.Values
	apikey string
	bearer string
	body   map[string]any
}

func fakeGoTrue(t *testing.T, status int, response string, seen *capture) *SupabaseAdminClient {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen.method = r.Method
		seen.path = r.URL.Path
		seen.query = r.URL.Query()
		seen.apikey = r.Header.Get("apikey")
		seen.bearer = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

		if raw, _ := io.ReadAll(r.Body); len(raw) > 0 {
			_ = json.Unmarshal(raw, &seen.body)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(response))
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

func TestCreateUserPostsToTheAdminEndpoint(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusOK, `{"id":"11111111-2222-4333-8444-555555555555"}`, &seen)

	id, err := client.CreateUser("11111111-2222-4333-8444-555555555555", "Owner@DMD.example", "hunter2hunter2", "Bakery Owner", " +971500000000 ")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	if id != "11111111-2222-4333-8444-555555555555" {
		t.Errorf("id = %q", id)
	}
	if seen.method != http.MethodPost || seen.path != "/admin/users" {
		t.Errorf("sent %s %s, want POST /admin/users", seen.method, seen.path)
	}
	if seen.body["email"] != "owner@dmd.example" {
		t.Errorf("email = %v, want it lowercased", seen.body["email"])
	}
	if seen.body["phone"] != "+971500000000" {
		t.Errorf("phone = %v, want it trimmed", seen.body["phone"])
	}
	// The backend is creating this account on an admin's behalf; making the new
	// employee confirm an address their manager just typed adds a failure point
	// without adding a check.
	if seen.body["email_confirm"] != true {
		t.Error("email_confirm is not true; invited staff would be stuck unconfirmed")
	}
	if seen.apikey == "" || seen.bearer == "" {
		t.Error("service role key must be sent as both apikey and bearer")
	}
}

// The import path for the migration. Passing the id explicitly is what makes
// the Appwrite -> Supabase mapping reproducible instead of a one-off backfill.
func TestCreateUserWithPasswordHashSendsTheHashAndTheId(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusOK, `{"id":"aaaaaaaa-0000-4000-8000-000000000001"}`, &seen)

	const hash = "$argon2id$v=19$m=2048,t=4,p=3$c2FsdHNhbHQ$aGFzaGhhc2g"
	if _, err := client.CreateUserWithPasswordHash(
		"aaaaaaaa-0000-4000-8000-000000000001", "staff@dmd.example", hash, "Staff", "",
	); err != nil {
		t.Fatalf("CreateUserWithPasswordHash: %v", err)
	}

	if seen.body["password_hash"] != hash {
		t.Errorf("password_hash = %v", seen.body["password_hash"])
	}
	if seen.body["id"] != "aaaaaaaa-0000-4000-8000-000000000001" {
		t.Errorf("id = %v, want the caller's deterministic id", seen.body["id"])
	}
	if _, sent := seen.body["password"]; sent {
		t.Error("a plaintext password was sent alongside the hash")
	}
	if _, sent := seen.body["phone"]; sent {
		t.Error("an empty phone should be omitted, not sent as an empty string")
	}
}

func TestDeleteUserUsesDelete(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusOK, `{}`, &seen)

	if err := client.DeleteUser("aaaaaaaa-0000-4000-8000-000000000001"); err != nil {
		t.Fatalf("DeleteUser: %v", err)
	}
	if seen.method != http.MethodDelete {
		t.Errorf("method = %s, want DELETE", seen.method)
	}
	if seen.path != "/admin/users/aaaaaaaa-0000-4000-8000-000000000001" {
		t.Errorf("path = %s", seen.path)
	}
}

// Appwrite had an explicit enable/disable. Supabase expresses the same thing as
// a ban with a duration, and "none" is what lifts it -- an empty string or a
// zero duration does not.
func TestSetUserStatusBansAndUnbans(t *testing.T) {
	for _, tc := range []struct {
		name    string
		enabled bool
		want    string
	}{
		{"disable", false, "876000h"},
		{"enable", true, "none"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var seen capture
			client := fakeGoTrue(t, http.StatusOK, `{}`, &seen)

			if err := client.SetUserStatus("aaaaaaaa-0000-4000-8000-000000000001", tc.enabled); err != nil {
				t.Fatalf("SetUserStatus: %v", err)
			}
			if seen.method != http.MethodPut {
				t.Errorf("method = %s, want PUT", seen.method)
			}
			if seen.body["ban_duration"] != tc.want {
				t.Errorf("ban_duration = %v, want %q", seen.body["ban_duration"], tc.want)
			}
		})
	}
}

func TestPasswordRecoveryUsesThePublicRecoverEndpoint(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusOK, `{}`, &seen)

	if err := client.CreatePasswordRecovery("Owner@DMD.example", "https://app.example/reset"); err != nil {
		t.Fatalf("CreatePasswordRecovery: %v", err)
	}
	if seen.path != "/recover" {
		t.Errorf("path = %s, want /recover", seen.path)
	}
	if seen.body["email"] != "owner@dmd.example" {
		t.Errorf("email = %v", seen.body["email"])
	}
	// In the query string, where GoTrue reads it. In the body it is ignored and
	// the link falls back to the Site URL root.
	if got := seen.query.Get("redirect_to"); got != "https://app.example/reset" {
		t.Errorf("redirect_to query = %q, want the reset URL", got)
	}
	if _, inBody := seen.body["redirect_to"]; inBody {
		t.Errorf("redirect_to was sent in the body, where GoTrue ignores it")
	}
}

// Completing a reset is two calls: trade the single-use token for a session,
// then change the password as that user. The second call must NOT use the
// service role key -- a password change should be authorised by proof of
// identity, not by a credential that can do anything to anyone.
func TestCompletePasswordRecoveryActsAsTheUserNotTheServiceRole(t *testing.T) {
	var calls []capture

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var seen capture
		seen.method, seen.path = r.Method, r.URL.Path
		seen.bearer = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if raw, _ := io.ReadAll(r.Body); len(raw) > 0 {
			_ = json.Unmarshal(raw, &seen.body)
		}
		calls = append(calls, seen)

		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/verify" {
			_, _ = w.Write([]byte(`{"access_token":"the-user-session"}`))
			return
		}
		_, _ = w.Write([]byte(`{}`))
	}))
	t.Cleanup(server.Close)

	client := NewSupabaseAdminClient(config.Config{
		SupabaseURL:            "https://examplerefnotreal01.supabase.co",
		SupabaseServiceRoleKey: "service-role-not-real",
		AppEnv:                 "production",
	})
	client.baseURL = server.URL

	if err := client.CompletePasswordRecovery("recovery-token", "newpassword123"); err != nil {
		t.Fatalf("CompletePasswordRecovery: %v", err)
	}

	if len(calls) != 2 {
		t.Fatalf("made %d calls, want 2 (verify then update)", len(calls))
	}
	if calls[0].path != "/verify" || calls[0].body["type"] != "recovery" || calls[0].body["token_hash"] != "recovery-token" {
		t.Errorf("first call = %s %v", calls[0].path, calls[0].body)
	}
	if calls[1].path != "/user" || calls[1].method != http.MethodPut {
		t.Errorf("second call = %s %s, want PUT /user", calls[1].method, calls[1].path)
	}
	if calls[1].bearer != "the-user-session" {
		t.Errorf("password change was authorised with %q, want the user's own session",
			calls[1].bearer)
	}
	if calls[1].body["password"] != "newpassword123" {
		t.Errorf("password = %v", calls[1].body["password"])
	}
}

func TestRecoveryFailsLoudlyOnAUsedLink(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusOK, `{}`, &seen) // no access_token in the response

	err := client.CompletePasswordRecovery("already-used", "newpassword123")
	if err == nil {
		t.Fatal("a used or invalid recovery link reported success")
	}
	if !strings.Contains(err.Error(), "invalid or has already been used") {
		t.Errorf("err = %v, want something a user can act on", err)
	}
}

// GoTrue has used several error shapes. Losing the message and reporting a bare
// status code is how "that email address was rejected" becomes "failed".
func TestErrorsKeepSupabasesOwnMessage(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusUnprocessableEntity,
		`{"code":422,"error_code":"email_address_invalid","msg":"Email address \"x@example.com\" is invalid"}`, &seen)

	_, err := client.CreateUser("", "x@example.com", "hunter2hunter2", "X", "")
	if err == nil {
		t.Fatal("a 422 was reported as success")
	}

	message, details := FriendlySupabaseCreateUserError(err)
	if !strings.Contains(message, "rejected") {
		t.Errorf("message = %q, want something actionable", message)
	}
	if details["supabase_error_code"] != "email_address_invalid" {
		t.Errorf("details lost the error code: %v", details)
	}
	if details["supabase_status_code"] != http.StatusUnprocessableEntity {
		t.Errorf("details lost the status: %v", details)
	}
}

func TestDuplicateEmailGetsItsOwnMessage(t *testing.T) {
	var seen capture
	client := fakeGoTrue(t, http.StatusUnprocessableEntity,
		`{"msg":"A user with this email address has already been registered"}`, &seen)

	_, err := client.CreateUser("", "taken@dmd.example", "hunter2hunter2", "X", "")
	message, _ := FriendlySupabaseCreateUserError(err)
	if !strings.Contains(message, "already exists") {
		t.Errorf("message = %q", message)
	}
}

// Before cutover the Supabase environment is unset. Constructing the client
// must be harmless, and calling it must fail clearly rather than firing a
// request at a malformed URL.
func TestUnconfiguredClientIsInert(t *testing.T) {
	client := NewSupabaseAdminClient(config.Config{AppEnv: "production"})

	if client.Configured() {
		t.Error("Configured() is true with no project ref or service key")
	}
	if _, err := client.CreateUser("", "a@b.example", "pw", "n", ""); err == nil {
		t.Error("CreateUser succeeded with no configuration")
	}
	if err := client.DeleteUser("x"); err == nil {
		t.Error("DeleteUser succeeded with no configuration")
	}
}
