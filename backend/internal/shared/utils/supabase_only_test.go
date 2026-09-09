package utils

import (
	"strings"
	"testing"

	"pastries-pos/internal/config"
)

// A deployment with no Appwrite at all -- the ordinary case for a clean-slate
// Supabase setup, and a state nothing here was written for until 2026-09-09.
//
// Before these, CreateUser called Appwrite first and unconditionally, so a
// deployment that simply left the Appwrite variables unset could not create an
// account at all. It did not fail at boot; it failed on the first sign-up.

func noAppwrite() *AppwriteClient {
	return NewAppwriteClient(config.Config{})
}

func TestAnUnconfiguredAppwriteClientKnowsIt(t *testing.T) {
	if noAppwrite().Configured() {
		t.Error("a client with no endpoint, project or key reported itself configured")
	}
	if !fakeAppwrite().Configured() {
		t.Error("the E2E client must count as configured; every manager test relies on it")
	}
	var nilClient *AppwriteClient
	if nilClient.Configured() {
		t.Error("a nil client reported itself configured")
	}

	partial := NewAppwriteClient(config.Config{AppwriteEndpoint: "https://appwrite.example.test/v1"})
	if partial.Configured() {
		t.Error("an endpoint with no key is a half-state; it must not count as configured")
	}
}

func TestSupabaseOnlyCreatesTheAccountInSupabaseAlone(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(noAppwrite(), spy.client(t), primaryAppwrite)

	ids, err := manager.CreateUser("owner@test.invalid", "hunter2hunter2", "Owner", "")
	if err != nil {
		t.Fatalf("CreateUser with no Appwrite: %v", err)
	}

	if ids.Supabase == "" {
		t.Error("no Supabase id came back")
	}
	if ids.Appwrite != "" {
		t.Errorf("an Appwrite id %q was invented for a deployment that has no Appwrite", ids.Appwrite)
	}
	if ids.AppwriteOrNil() != nil {
		t.Error("AppwriteOrNil must be nil here, or the users insert writes an empty string " +
			"into a unique column and the second account collides")
	}
	if !spy.called("/admin/users") {
		t.Error("Supabase was never asked to create the account")
	}
}

// The flag says "appwrite", but there is no Appwrite. Supabase is primary
// because it is the only provider there is -- password resets must come from
// somewhere, and the flag cannot point at a provider that does not exist.
func TestSupabaseIsPrimaryWhenItIsTheOnlyProvider(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(noAppwrite(), spy.client(t), primaryAppwrite)

	if !manager.PrimaryIsSupabase() {
		t.Fatal("Supabase is the only configured provider and is not primary")
	}
	if err := manager.CreatePasswordRecovery("owner@test.invalid", "https://app.example/reset"); err != nil {
		t.Fatalf("CreatePasswordRecovery: %v", err)
	}
	if !spy.called("/recover") {
		t.Error("the reset email was not sent through Supabase, and there is nothing else to send it")
	}
}

func TestNoProviderAtAllIsAnErrorNotAPanic(t *testing.T) {
	unconfigured := NewSupabaseAdminClient(config.Config{})
	manager := NewIdentityManager(noAppwrite(), unconfigured, primaryAppwrite)

	_, err := manager.CreateUser("owner@test.invalid", "hunter2hunter2", "Owner", "")
	if err == nil {
		t.Fatal("account creation succeeded with no identity provider configured")
	}
	if !strings.Contains(err.Error(), "no identity provider") {
		t.Errorf("err = %v, want it to say no provider is configured", err)
	}
}

// Deleting, disabling and signing out must not touch a provider that is not
// there, even for a row that still carries an old Appwrite id.
func TestLifecycleSkipsAnAbsentAppwrite(t *testing.T) {
	spy := &supabaseSpy{}
	manager := NewIdentityManager(noAppwrite(), spy.client(t), primaryAppwrite)
	ids := ProviderIDs{Appwrite: "stale-appwrite-id", Supabase: "bbbbbbbb-0000-4000-8000-000000000002"}

	if err := manager.DeleteUser(ids); err != nil {
		t.Errorf("DeleteUser reached an Appwrite that does not exist: %v", err)
	}
	if err := manager.SetUserStatus(ids, false); err != nil {
		t.Errorf("SetUserStatus reached an Appwrite that does not exist: %v", err)
	}
	manager.RevokeSessions(ids) // must simply not panic

	if err := manager.CompletePasswordRecovery("user", "secret", "", "newpassword123"); err == nil {
		t.Error("an Appwrite-shaped reset link completed with no Appwrite to complete it")
	}
}
