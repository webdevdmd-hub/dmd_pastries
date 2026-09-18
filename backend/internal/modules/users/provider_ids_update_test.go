package users

import (
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-064 — Staff > Create User failed with "failed to link
// identity provider user" for every account after the first.
//
// With Supabase as the only identity provider, ProviderIDs.Appwrite is empty.
// UpdateProviderIDs still wrote it, so the first staff account created this
// way stored appwrite_user_id = '' and every later one collided with it on the
// column's global unique index (NULLs are distinct under it, '' is not). The
// Supabase account was then deleted again and the admin saw the error.
//
// Found by /qa on 2026-09-18 while creating an RBAC test user on production.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md

// updatedColumns returns column -> value for the UPDATE GORM would run.
func updatedColumns(t *testing.T, ids utils.ProviderIDs) map[string]any {
	t.Helper()
	db, err := gorm.Open(postgres.New(postgres.Config{DriverName: "pgx"}), &gorm.Config{
		DryRun:                 true,
		DisableAutomaticPing:   true,
		SkipDefaultTransaction: true,
		Logger:                 logger.Discard,
	})
	if err != nil {
		t.Fatalf("open dry-run gorm: %v", err)
	}
	var stmt *gorm.Statement
	if err := db.Callback().Update().After("gorm:update").Register("test:capture", func(tx *gorm.DB) {
		stmt = tx.Statement
	}); err != nil {
		t.Fatalf("register capture callback: %v", err)
	}

	if err := (&Repository{}).UpdateProviderIDs(db, "user-id", ids); err != nil {
		t.Fatalf("UpdateProviderIDs: %v", err)
	}
	if stmt == nil {
		t.Fatal("UpdateProviderIDs built no UPDATE")
	}

	sql := stmt.SQL.String()
	set, where := strings.Index(sql, " SET "), strings.Index(sql, " WHERE ")
	if set == -1 || where == -1 {
		t.Fatalf("not an UPDATE: %s", sql)
	}
	columns := map[string]any{}
	for i, assignment := range strings.Split(sql[set+len(" SET "):where], ",") {
		column := strings.Trim(strings.TrimSpace(strings.SplitN(assignment, "=", 2)[0]), `"`)
		columns[column] = stmt.Vars[i]
	}
	return columns
}

func TestUpdateProviderIDsNeverWritesAnEmptyAppwriteID(t *testing.T) {
	columns := updatedColumns(t, utils.ProviderIDs{Supabase: "5b0c1f7e-9d7a-4a51-8a54-0f6f0d2c9e11"})

	if value, ok := columns["appwrite_user_id"]; ok {
		t.Fatalf("a Supabase-only account must leave appwrite_user_id NULL; the UPDATE sets it to %#v", value)
	}
	if got := columns["supabase_user_id"]; got != "5b0c1f7e-9d7a-4a51-8a54-0f6f0d2c9e11" {
		t.Fatalf("supabase_user_id = %#v, want the new Supabase id", got)
	}
}

func TestUpdateProviderIDsWritesBothIDsWhenBothProvidersAreLive(t *testing.T) {
	columns := updatedColumns(t, utils.ProviderIDs{
		Appwrite: "66f0c2a1000b",
		Supabase: "5b0c1f7e-9d7a-4a51-8a54-0f6f0d2c9e11",
	})

	if got := columns["appwrite_user_id"]; got != "66f0c2a1000b" {
		t.Fatalf("appwrite_user_id = %#v, want the Appwrite id", got)
	}
	if got := columns["supabase_user_id"]; got != "5b0c1f7e-9d7a-4a51-8a54-0f6f0d2c9e11" {
		t.Fatalf("supabase_user_id = %#v, want the Supabase id", got)
	}
}

func TestUpdateProviderIDsWritesTheAppwriteIDBeforeCutover(t *testing.T) {
	columns := updatedColumns(t, utils.ProviderIDs{Appwrite: "66f0c2a1000b"})

	if got := columns["appwrite_user_id"]; got != "66f0c2a1000b" {
		t.Fatalf("appwrite_user_id = %#v, want the Appwrite id", got)
	}
	if value, ok := columns["supabase_user_id"]; ok {
		t.Fatalf("an Appwrite-only account must leave supabase_user_id NULL; the UPDATE sets it to %#v", value)
	}
}
