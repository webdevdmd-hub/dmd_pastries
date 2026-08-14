// Package testdb gives tests a real Postgres database.
//
// The repository had no database-backed test of any kind, and it has cost
// twice already: migration 000106 wrote to a table that does not exist and
// would have stopped the backend booting, and the year-end close built a
// non-UUID key for a uuid column so every close would have failed. Both shipped
// with every suite green, because nothing in the test suite ran SQL.
//
// What needs a real database, and cannot be faked:
//
//   - migrations, which are only otherwise exercised at boot
//   - column type and constraint mismatches
//   - GORM's routing of sql.Scanner / driver.Valuer, which decides whether a
//     money.Amount reads back as its value or as zero
//
// # Usage
//
//	func TestSomething(t *testing.T) {
//	    db := testdb.Tx(t)   // rolled back when the test ends
//	    ...
//	}
//
// # Configuration
//
// Credentials come from the same POSTGRES_* variables (or DATABASE_URL) the
// application uses, so a working dev setup is a working test setup. The
// database NAME is always overridden -- see the safety note below.
//
//	TEST_POSTGRES_DB    name of the test database (default pastries_pos_test)
//	TEST_DATABASE_URL   full DSN, used verbatim; overrides the above
//	REQUIRE_DB_TESTS=1  turn "no database reachable" from a skip into a failure
//
// # Safety
//
// These tests truncate and roll back real tables, so pointing them at a
// working database would destroy data. The harness refuses to connect to any
// database whose name does not end in "_test". That check is not
// configurable, and it is the reason the database name is never taken from
// the application's own POSTGRES_DB.
package testdb

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"pastries-pos/internal/database"
)

const (
	defaultTestDatabase = "pastries_pos_test"
	requiredSuffix      = "_test"
)

var (
	once      sync.Once
	shared    *gorm.DB
	setupErr  error
	skipCause string
)

// Tx returns a database handle bound to a transaction that is rolled back when
// the test finishes, so tests neither see nor leave each other's rows.
//
// Code under test that opens its own transaction still works: GORM nests it as
// a savepoint.
func Tx(t *testing.T) *gorm.DB {
	t.Helper()
	db := Connect(t)

	tx := db.Begin()
	if tx.Error != nil {
		t.Fatalf("testdb: begin transaction: %v", tx.Error)
	}
	t.Cleanup(func() {
		if err := tx.Rollback().Error; err != nil && !strings.Contains(err.Error(), "closed") {
			t.Errorf("testdb: rollback: %v", err)
		}
	})
	return tx
}

// Connect returns the shared migrated test database. Prefer Tx unless the test
// genuinely needs to commit.
func Connect(t *testing.T) *gorm.DB {
	t.Helper()
	once.Do(setup)

	if skipCause != "" {
		if os.Getenv("REQUIRE_DB_TESTS") == "1" {
			t.Fatalf("testdb: REQUIRE_DB_TESTS=1 but no database is available: %s", skipCause)
		}
		t.Skipf("testdb: skipping, no database available (%s). "+
			"Start Postgres and re-run, or set REQUIRE_DB_TESTS=1 to make this a failure.", skipCause)
	}
	if setupErr != nil {
		t.Fatalf("testdb: %v", setupErr)
	}
	return shared
}

func setup() {
	loadEnvFile()

	dsn, name, err := resolveDSN()
	if err != nil {
		setupErr = err
		return
	}
	// Never negotiable, and checked before anything connects to the target
	// database or runs a migration against it, so a misconfiguration is
	// contained rather than merely reported.
	if err := validateTestDatabaseName(name); err != nil {
		setupErr = err
		return
	}

	if err := ensureDatabaseExists(dsn, name); err != nil {
		skipCause = err.Error()
		return
	}

	db, err := open(dsn)
	if err != nil {
		skipCause = fmt.Sprintf("cannot connect to %s: %v", name, err)
		return
	}

	migrations, err := migrationsDir()
	if err != nil {
		setupErr = err
		return
	}
	// Applying the real migration set is itself the point: it is the only
	// place they run outside of booting the application.
	if _, err := database.RunMigrations(db, migrations); err != nil {
		setupErr = fmt.Errorf("running migrations into %s: %w", name, err)
		return
	}
	shared = db
}

func open(dsn string) (*gorm.DB, error) {
	// Same driver settings as the application, so the harness exercises the
	// behaviour production gets -- PreferSimpleProtocol in particular decides
	// whether NUMERIC arrives as text.
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	if err := sqlDB.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

// ensureDatabaseExists creates the test database when it is missing, by
// connecting to the maintenance database alongside it.
func ensureDatabaseExists(dsn, name string) error {
	adminDSN, err := withDatabase(dsn, "postgres")
	if err != nil {
		return err
	}
	admin, err := open(adminDSN)
	if err != nil {
		return fmt.Errorf("cannot reach Postgres: %v", err)
	}
	defer func() {
		if sqlDB, err := admin.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	var count int64
	if err := admin.Raw("SELECT COUNT(*) FROM pg_database WHERE datname = ?", name).Scan(&count).Error; err != nil {
		return fmt.Errorf("checking for database %s: %v", name, err)
	}
	if count > 0 {
		return nil
	}
	// The name is validated against the _test suffix before we get here, and
	// identifiers cannot be parameterised.
	if err := admin.Exec(`CREATE DATABASE "` + name + `"`).Error; err != nil {
		return fmt.Errorf("creating database %s: %v", name, err)
	}
	return nil
}

// validateTestDatabaseName is the guard that keeps this harness away from a
// working database. The suffix is required rather than merely conventional:
// these tests create, write and roll back real tables.
func validateTestDatabaseName(name string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fmt.Errorf("no test database name was resolved")
	}
	if !strings.HasSuffix(trimmed, requiredSuffix) {
		return fmt.Errorf(
			"refusing to run against database %q: the test database name must end in %q, "+
				"so a working database can never be used by mistake", trimmed, requiredSuffix)
	}
	return nil
}

// resolveDSN returns the connection string and the database name it targets.
func resolveDSN() (string, string, error) {
	if raw := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL")); raw != "" {
		name, err := databaseName(raw)
		if err != nil {
			return "", "", err
		}
		return raw, name, nil
	}

	name := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DB"))
	if name == "" {
		name = defaultTestDatabase
	}
	// Deliberately built from the parts rather than from DATABASE_URL: the
	// application's own database name must not leak in.
	host := envOr("POSTGRES_HOST", "127.0.0.1")
	port := envOr("POSTGRES_PORT", "5432")
	user := envOr("POSTGRES_USER", "postgres")
	password := envOr("POSTGRES_PASSWORD", "postgres")
	sslMode := envOr("POSTGRES_SSLMODE", "disable")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		host, user, password, name, port, sslMode)
	return dsn, name, nil
}

func databaseName(dsn string) (string, error) {
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		parsed, err := url.Parse(dsn)
		if err != nil {
			return "", fmt.Errorf("parsing TEST_DATABASE_URL: %w", err)
		}
		return strings.TrimPrefix(parsed.Path, "/"), nil
	}
	for _, field := range strings.Fields(dsn) {
		if strings.HasPrefix(field, "dbname=") {
			return strings.TrimPrefix(field, "dbname="), nil
		}
	}
	return "", fmt.Errorf("cannot determine the database name from TEST_DATABASE_URL")
}

func withDatabase(dsn, name string) (string, error) {
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		parsed, err := url.Parse(dsn)
		if err != nil {
			return "", err
		}
		parsed.Path = "/" + name
		return parsed.String(), nil
	}
	fields := strings.Fields(dsn)
	replaced := false
	for index, field := range fields {
		if strings.HasPrefix(field, "dbname=") {
			fields[index] = "dbname=" + name
			replaced = true
		}
	}
	if !replaced {
		fields = append(fields, "dbname="+name)
	}
	return strings.Join(fields, " "), nil
}

// migrationsDir walks up from the test's working directory to find the
// migrations, so the harness works from any package.
func migrationsDir() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for depth := 0; depth < 10; depth++ {
		candidate := filepath.Join(dir, "migrations")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			if entries, err := os.ReadDir(candidate); err == nil && len(entries) > 0 {
				return candidate, nil
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("cannot locate the migrations directory above the working directory")
}

// loadEnvFile reads backend/.env so a developer with a working local setup
// needs no extra configuration. Real environment variables win.
func loadEnvFile() {
	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for depth := 0; depth < 10; depth++ {
		candidate := filepath.Join(dir, ".env")
		if _, err := os.Stat(candidate); err == nil {
			_ = godotenv.Load(candidate)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
