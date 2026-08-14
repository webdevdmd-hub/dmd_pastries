package testdb_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"pastries-pos/internal/database"
	"pastries-pos/internal/testsupport/testdb"
)

// Migration 000106 shipped an INSERT against a table that does not exist. The
// migrator returns the error and boot aborts, so the backend would not have
// started -- and nothing caught it, because migrations only ever ran at boot.
//
// Simply reaching this test proves they all applied: the harness runs the full
// set during setup and fails every database test if any of them errors. The
// assertions below make the intent explicit and catch the quieter variant, a
// migration that is skipped rather than run.
func TestEveryMigrationApplies(t *testing.T) {
	db := testdb.Connect(t)

	dir := findMigrations(t)
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read migrations: %v", err)
	}
	onDisk := 0
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			onDisk++
		}
	}
	if onDisk == 0 {
		t.Fatal("no migrations found; this test would pass vacuously")
	}

	var applied int64
	if err := db.Raw("SELECT COUNT(*) FROM schema_migrations").Scan(&applied).Error; err != nil {
		t.Fatalf("count applied migrations: %v", err)
	}
	if int(applied) != onDisk {
		t.Fatalf("%d migrations on disk but %d recorded as applied", onDisk, applied)
	}
}

// The application refuses to serve a schema it does not recognise, and that
// check now runs in tests rather than only against whatever database an
// operator happens to point it at.
func TestSchemaMatchesWhatTheApplicationExpects(t *testing.T) {
	db := testdb.Connect(t)
	if err := database.VerifySchema(db); err != nil {
		t.Fatalf("schema verification failed against a freshly migrated database: %v", err)
	}
}

// A migration is recorded with a checksum. Editing one that has already been
// applied means the recorded checksum no longer describes the file, and the
// difference goes unnoticed because the migrator skips by version alone.
func TestAppliedMigrationChecksumsAreRecorded(t *testing.T) {
	db := testdb.Connect(t)

	var blank int64
	if err := db.Raw(
		"SELECT COUNT(*) FROM schema_migrations WHERE checksum IS NULL OR checksum = ''",
	).Scan(&blank).Error; err != nil {
		t.Fatalf("query checksums: %v", err)
	}
	if blank > 0 {
		t.Fatalf("%d applied migrations have no recorded checksum", blank)
	}
}

func findMigrations(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for depth := 0; depth < 10; depth++ {
		candidate := filepath.Join(dir, "migrations")
		if info, statErr := os.Stat(candidate); statErr == nil && info.IsDir() {
			if entries, readErr := os.ReadDir(candidate); readErr == nil && len(entries) > 0 {
				return candidate
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	t.Fatal("cannot locate the migrations directory")
	return ""
}

// A live assertion to sit alongside the unit-tested name guard: whatever the
// configuration resolved to, the connection these tests actually hold must be
// to a test database. Every test here writes and rolls back real tables.
func TestConnectionIsActuallyToATestDatabase(t *testing.T) {
	db := testdb.Connect(t)

	var name string
	if err := db.Raw("SELECT current_database()").Scan(&name).Error; err != nil {
		t.Fatalf("read current database: %v", err)
	}
	if !strings.HasSuffix(name, "_test") {
		t.Fatalf("connected to %q, which is not a test database", name)
	}
}
