package testdb

import "testing"

// The harness writes to and rolls back real tables. Pointed at a working
// database it would destroy data, so the name guard is the single most
// important thing in this package.
//
// It is checked in setup before anything connects to the target database or
// runs a migration against it, which is why an accident is contained rather
// than merely reported.
func TestOnlyDatabasesNamedForTestingAreAccepted(t *testing.T) {
	accepted := []string{"pastries_pos_test", "anything_test", "_test"}
	for _, name := range accepted {
		if err := validateTestDatabaseName(name); err != nil {
			t.Fatalf("%q should be usable as a test database: %v", name, err)
		}
	}

	refused := []string{
		"pastries_pos",      // the development database
		"postgres",          // the maintenance database
		"pastries_pos_prod", // anything that is not explicitly a test database
		"test",              // a bare name, not a _test suffix
		"test_pastries_pos", // prefix rather than suffix
		"",
	}
	for _, name := range refused {
		if err := validateTestDatabaseName(name); err == nil {
			t.Fatalf("%q must be refused as a test database", name)
		}
	}
}

// The database name is deliberately not taken from the application's own
// POSTGRES_DB, so a developer's working database cannot become the target by
// inheriting configuration.
func TestResolvedDSNIgnoresTheApplicationDatabaseName(t *testing.T) {
	t.Setenv("POSTGRES_DB", "pastries_pos")
	t.Setenv("TEST_POSTGRES_DB", "")
	t.Setenv("TEST_DATABASE_URL", "")

	_, name, err := resolveDSN()
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if name == "pastries_pos" {
		t.Fatal("the test database name must not be inherited from POSTGRES_DB")
	}
	if err := validateTestDatabaseName(name); err != nil {
		t.Fatalf("the default test database name must pass the guard: %v", err)
	}
}

func TestDatabaseNameIsExtractedFromEitherDSNForm(t *testing.T) {
	cases := map[string]string{
		"postgresql://user:pass@localhost:5432/some_test?sslmode=disable": "some_test",
		"postgres://user:pass@localhost:5432/some_test":                   "some_test",
		"host=localhost user=u password=p dbname=some_test port=5432":     "some_test",
	}
	for dsn, want := range cases {
		got, err := databaseName(dsn)
		if err != nil {
			t.Fatalf("%s: %v", dsn, err)
		}
		if got != want {
			t.Fatalf("%s: got %q, want %q", dsn, got, want)
		}
	}
	if _, err := databaseName("host=localhost user=u"); err == nil {
		t.Fatal("a DSN with no database name must be an error, not an empty name that skips the guard")
	}
}
