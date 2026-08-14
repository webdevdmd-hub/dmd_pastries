package testdb_test

import (
	"testing"

	"pastries-pos/internal/shared/money"
	"pastries-pos/internal/testsupport/testdb"
)

// Read-mostly modules total money with bare scalar scans --
// db.Raw("SELECT SUM(...)").Scan(&total) -- rather than through a model field.
// Whether GORM routes those through money.Amount's Scanner decides if those
// modules can hold exact values or must keep converting at the boundary.
func TestScalarSumScansIntoAnAmount(t *testing.T) {
	db := testdb.Tx(t)
	if err := db.Exec(`CREATE TABLE scalar_probe (amount numeric(14,2) NOT NULL)`).Error; err != nil {
		t.Fatalf("create probe: %v", err)
	}
	for _, text := range []string{"33.33", "33.33", "33.34"} {
		if err := db.Exec(`INSERT INTO scalar_probe (amount) VALUES (?)`, text).Error; err != nil {
			t.Fatalf("insert %s: %v", text, err)
		}
	}

	var total money.Amount
	if err := db.Raw(`SELECT COALESCE(SUM(amount), 0) FROM scalar_probe`).Scan(&total).Error; err != nil {
		t.Fatalf("scalar scan: %v", err)
	}
	expected, _ := money.FromString("100.00")
	if !total.Equal(expected) {
		t.Fatalf("scalar sum scanned as %s, want 100.00 -- GORM is not routing through the Scanner", total)
	}

	// And an empty set must scan as zero, not error.
	if err := db.Exec(`DELETE FROM scalar_probe`).Error; err != nil {
		t.Fatalf("clear: %v", err)
	}
	var empty money.Amount
	if err := db.Raw(`SELECT COALESCE(SUM(amount), 0) FROM scalar_probe`).Scan(&empty).Error; err != nil {
		t.Fatalf("empty scalar scan: %v", err)
	}
	if !empty.IsZero() {
		t.Fatalf("empty sum scanned as %s, want zero", empty)
	}
}
