package accounting_test

import (
	"database/sql"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
)

// capturedSQL builds SQL without touching a database, so this runs in CI with
// no Postgres available, and hands back whatever the repository generated.
func capturedSQL(t *testing.T, run func(repo *accounting.Repository)) string {
	t.Helper()

	db, err := gorm.Open(
		postgres.New(postgres.Config{Conn: (*sql.DB)(nil)}),
		&gorm.Config{DisableAutomaticPing: true, DryRun: true},
	)
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}

	var statement string
	registerErr := db.Callback().Query().After("gorm:query").Register(
		"test:capture_sql",
		func(tx *gorm.DB) { statement = tx.Statement.SQL.String() },
	)
	if registerErr != nil {
		t.Fatalf("register callback: %v", registerErr)
	}

	run(accounting.NewRepository(db))

	if statement == "" {
		t.Fatal("no SQL was generated")
	}

	return statement
}

// The General Ledger report 500'd with "failed to load chart account" for every
// single-account run, while the combined run succeeded. The account lookup is
// the only thing that differs between the two.
//
// The cause was GORM's First(), which appends ORDER BY <primary key>. The
// destination is a projection DTO with no primary key, so GORM fell back to its
// first column -- account_id, which is the SELECT alias, not a real column on
// chart_of_accounts. Postgres rejected the ORDER BY, the error was not
// ErrRecordNotFound, so it surfaced as a 500 rather than a 404.
func TestFindAccountForReportDoesNotOrderByTheProjectionAlias(t *testing.T) {
	statement := capturedSQL(t, func(repo *accounting.Repository) {
		//nolint:errcheck // DryRun never executes; the SQL is the subject.
		_, _ = repo.FindAccountForReport(
			"11111111-1111-4111-8111-111111111111",
			"22222222-2222-4222-8222-222222222222",
		)
	})

	if strings.Contains(statement, "ORDER BY") {
		t.Errorf("id = ? already selects at most one row; the ORDER BY can only name a column that is not there:\n%s", statement)
	}
	if !strings.Contains(statement, "LIMIT") {
		t.Errorf("query should still fetch a single row:\n%s", statement)
	}
	if !strings.Contains(statement, "chart_of_accounts") {
		t.Errorf("query should read chart_of_accounts:\n%s", statement)
	}
}
