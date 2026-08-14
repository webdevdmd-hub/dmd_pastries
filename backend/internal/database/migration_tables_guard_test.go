package database

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Migration 000106 shipped an INSERT against "account_mappings" when the real
// table is "accounting_account_mappings". Nothing caught it: the migrator only
// discovers the mistake at boot, and it hard-fails there, so the whole backend
// refuses to start. Unit tests never touch Postgres, so the build stayed green.
//
// This guard closes that gap statically -- every table a migration writes to
// must be created by some migration (or be one of the few tables that exist
// outside the migration set).
//
// It is deliberately conservative: it checks statement targets (INSERT INTO,
// ALTER TABLE, UPDATE, DELETE FROM), not arbitrary FROM/JOIN clauses, so it
// cannot be tripped by CTEs, aliases, or subqueries.

var tablesCreatedOutsideMigrations = map[string]string{
	// Created by ensureMigrationTable in migrator.go before any migration runs.
	"schema_migrations": "bootstrapped by the migrator itself",
}

var (
	createTableRe  = regexp.MustCompile(`(?is)\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:(?:TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)`)
	writeTargetRe  = regexp.MustCompile(`(?is)\b(?:INSERT\s+INTO|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?|UPDATE|DELETE\s+FROM)\s+(?:ONLY\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)`)
	lineCommentRe  = regexp.MustCompile(`(?m)--.*$`)
	blockCommentRe = regexp.MustCompile(`(?s)/\*.*?\*/`)
)

func migrationsDir(t *testing.T) string {
	t.Helper()
	dir := filepath.Join("..", "..", "migrations")
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("cannot locate migrations directory at %s: %v", dir, err)
	}
	return dir
}

func stripSQLComments(sql string) string {
	return lineCommentRe.ReplaceAllString(blockCommentRe.ReplaceAllString(sql, " "), "")
}

// normalizeTable drops an optional schema qualifier so "public.foo" and "foo"
// compare equal, and lowercases (Postgres folds unquoted identifiers).
func normalizeTable(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	if idx := strings.LastIndex(name, "."); idx >= 0 {
		name = name[idx+1:]
	}
	return name
}

func TestMigrationWritesTargetExistingTables(t *testing.T) {
	dir := migrationsDir(t)
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		t.Fatalf("glob migrations: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("no migrations found -- the guard would pass vacuously")
	}
	sort.Strings(files)

	// UPDATE ... SET is also how CREATE TABLE bodies get written, so build the
	// created-table set across every migration first: a table created by a
	// later migration is still a legitimate target for that same migration.
	created := map[string]bool{}
	for table := range tablesCreatedOutsideMigrations {
		created[table] = true
	}
	contents := make(map[string]string, len(files))
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		sql := stripSQLComments(string(raw))
		contents[file] = sql
		for _, match := range createTableRe.FindAllStringSubmatch(sql, -1) {
			created[normalizeTable(match[1])] = true
		}
	}

	for _, file := range files {
		name := filepath.Base(file)
		for _, match := range writeTargetRe.FindAllStringSubmatch(contents[file], -1) {
			table := normalizeTable(match[1])
			// "UPDATE" also appears as "ON UPDATE CASCADE" inside constraints;
			// those capture a keyword rather than a table, so ignore anything
			// that is plainly SQL syntax.
			switch table {
			case "cascade", "restrict", "set", "no", "current_timestamp", "now":
				continue
			}
			if !created[table] {
				t.Errorf("%s writes to table %q, which no migration creates -- "+
					"this fails at boot, not at build time (see migration 000106)", name, table)
			}
		}
	}
}
