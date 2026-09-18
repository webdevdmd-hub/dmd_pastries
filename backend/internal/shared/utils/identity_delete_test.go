package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"pastries-pos/internal/config"
)

// Regression: ISSUE-075 — deleting a staff user left their Supabase login in
// place (banned for ~100 years), so it kept their email and phone and the same
// person could never be added again. Staff delete now removes the login before
// committing; a retry after a failed commit must not fail because the login is
// already gone.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

// supabaseAnswering is a Supabase admin API that answers every request with
// the given status.
func supabaseAnswering(t *testing.T, status int) *SupabaseAdminClient {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if status >= 300 {
			_, _ = w.Write([]byte(`{"msg":"answer"}`))
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
	return client
}

func TestDeletingALoginThatIsAlreadyGoneSucceeds(t *testing.T) {
	supabaseOnly := func(status int) *IdentityManager {
		return NewIdentityManager(NewAppwriteClient(config.Config{}), supabaseAnswering(t, status), primarySupabase)
	}
	ids := ProviderIDs{Supabase: "5b0c1f7e-9d7a-4a51-8a54-0f6f0d2c9e11"}

	if err := supabaseOnly(http.StatusOK).DeleteUser(ids); err != nil {
		t.Fatalf("deleting a live login failed: %v", err)
	}
	if err := supabaseOnly(http.StatusNotFound).DeleteUser(ids); err != nil {
		t.Fatalf("deleting a login that is already gone must count as deleted, got %v", err)
	}
	if err := supabaseOnly(http.StatusInternalServerError).DeleteUser(ids); err == nil {
		t.Fatal("a real Supabase failure must still fail the delete, so nothing is half-deleted")
	}
}

func TestHasLoginIsFalseOnlyWhenEveryProviderIDIsEmpty(t *testing.T) {
	cases := []struct {
		ids  ProviderIDs
		want bool
	}{
		{ProviderIDs{}, false},
		{ProviderIDs{Appwrite: "  ", Supabase: ""}, false},
		{ProviderIDs{Supabase: "5b0c1f7e-9d7a-4a51-8a54-0f6f0d2c9e11"}, true},
		{ProviderIDs{Appwrite: "66f0c2a1000b"}, true},
	}
	for _, tc := range cases {
		if got := tc.ids.HasLogin(); got != tc.want {
			t.Errorf("%+v.HasLogin() = %v, want %v", tc.ids, got, tc.want)
		}
	}
}
