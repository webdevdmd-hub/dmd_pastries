package utils

import (
	"errors"
	"regexp"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// The defect this guards: substring(col from ?) with the start position as a
// bind parameter reaches Postgres as text, which selects the regex form of
// substring — the extraction returns NULL, MAX collapses to 0, and every
// document number regenerates as PREFIX-000001. The position must appear in
// the SQL as an integer literal.
func TestNextSequentialNumberInlinesSubstringPosition(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{DriverName: "pgx"}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
		Logger:               logger.Discard,
	})
	if err != nil {
		t.Fatalf("open dry-run gorm: %v", err)
	}

	query := db.Table("sales").Where("business_id = ?", "b1")
	// DryRun renders the statement but refuses to execute Scan, so the only
	// acceptable error is ErrDryRunModeUnsupported — anything else is real.
	if _, err := NextSequentialNumber(query, "sale_number", "SALE-20260810-", 6); err != nil &&
		!errors.Is(err, gorm.ErrDryRunModeUnsupported) {
		t.Fatalf("NextSequentialNumber: %v", err)
	}

	sql := query.Statement.SQL.String()
	if sql == "" {
		t.Fatal("no SQL was rendered")
	}

	// len("SALE-20260810-")+1 = 15: the positional literal must be in the SQL,
	// in both the numeric-suffix filter and the MAX() extraction.
	if got := strings.Count(sql, "substring(sale_number from 15)"); got != 2 {
		t.Fatalf("expected the substring start position inlined as an integer literal twice, found %d:\n%s", got, sql)
	}
	if bound := regexp.MustCompile(`from \$\d+`).FindString(sql); bound != "" {
		t.Fatalf("substring start position is a bind parameter (%q), which Postgres treats as the regex form:\n%s", bound, sql)
	}
}
