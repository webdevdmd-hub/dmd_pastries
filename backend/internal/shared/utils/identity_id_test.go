package utils

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"pastries-pos/internal/config"
)

// The namespace is the root of every Supabase id. Changing it re-mints all of
// them and orphans every users.supabase_user_id already written, which is not
// something a code review would necessarily notice -- so it is pinned by value.
func TestIdentityNamespaceNeverChanges(t *testing.T) {
	const pinned = "3f2a1c58-9d4e-5b7a-8c16-2e9d4f7a1b03"
	if got := identityNamespace.String(); got != pinned {
		t.Fatalf("identity namespace = %s, want %s\n\n"+
			"Changing this re-derives every Supabase id. Existing rows keep the old\n"+
			"values, so the mapping silently splits in two and the users linked under\n"+
			"the old namespace can no longer be resolved.", got, pinned)
	}
}

func TestSupabaseUserIDIsStableAndDistinct(t *testing.T) {
	first := SupabaseUserIDForAppwriteID("68b1f0a2c3d4e5f60718")
	if first != SupabaseUserIDForAppwriteID("68b1f0a2c3d4e5f60718") {
		t.Error("the same Appwrite id produced two different Supabase ids")
	}
	if first == SupabaseUserIDForAppwriteID("68b1f0a2c3d4e5f60719") {
		t.Error("two Appwrite ids collided on one Supabase id")
	}
	if SupabaseUserIDForAppwriteID("  ") != "" {
		t.Error("a blank Appwrite id produced a real uuid; every such account " +
			"would collide on that one value")
	}
}

// The regression this whole change exists for.
//
// Dual-write used to let Supabase invent a random id while the bulk import
// derived one. Nothing failed at the time. It surfaced only when the import was
// re-run: the ids disagreed, the import tried to create the deterministic
// account, hit the email collision, and pointed the local row at a UUID that no
// Supabase user has -- so that employee could not sign in after cutover, with
// no error anywhere.
func TestDualWriteUsesTheSameIdTheImportWould(t *testing.T) {
	var sentID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		if id, ok := body["id"].(string); ok {
			sentID = id
		}
		w.Header().Set("Content-Type", "application/json")
		// Real GoTrue honours an explicit id and echoes it back. Echoing is
		// what makes this an end-to-end assertion rather than a check that we
		// merely asked nicely.
		_, _ = w.Write([]byte(`{"id":"` + sentID + `"}`))
	}))
	t.Cleanup(server.Close)

	client := NewSupabaseAdminClient(config.Config{
		SupabaseURL:            "https://examplerefnotreal01.supabase.co",
		SupabaseServiceRoleKey: "service-role-not-real",
		AppEnv:                 "production",
	})
	client.baseURL = server.URL

	ids, err := NewIdentityManager(fakeAppwrite(), client, "appwrite").
		CreateUser("newhire@test.invalid", "hunter2hunter2", "New Hire", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	want := SupabaseUserIDForAppwriteID(ids.Appwrite)
	if sentID != want {
		t.Errorf("dual-write asked Supabase for id %q, want the derived %q", sentID, want)
	}
	if ids.Supabase != want {
		t.Errorf("stored supabase_user_id = %q, want %q -- re-running the import "+
			"would see a mismatch and relink this user to a nonexistent account",
			ids.Supabase, want)
	}
}
