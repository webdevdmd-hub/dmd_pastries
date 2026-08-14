package accounting_test

import (
	"testing"
	"time"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/testsupport/testdb"
)

// Period locking (Phase 5 / W1) against a real database.
//
// The guard reads company_settings.books_closed_through and compares dates, so
// it can only be trusted once it has run against Postgres: a date comparison
// that works in Go can still be wrong across a DATE column and a timestamptz.

func TestPeriodLockBlocksOnAndBeforeTheLockDate(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)

	closedThrough := time.Date(2026, time.June, 30, 0, 0, 0, 0, time.UTC)
	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = ? WHERE business_id = ?`,
		closedThrough.Format("2006-01-02"), seed.BusinessID,
	).Error; err != nil {
		t.Fatalf("set lock: %v", err)
	}

	cases := []struct {
		name    string
		date    time.Time
		blocked bool
	}{
		{"well before the lock", time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC), true},
		{"the day before the lock", time.Date(2026, time.June, 29, 0, 0, 0, 0, time.UTC), true},
		// The lock is inclusive: the closing date itself is filed.
		{"the lock date itself", closedThrough, true},
		{"the day after the lock", time.Date(2026, time.July, 1, 0, 0, 0, 0, time.UTC), false},
		{"well after the lock", time.Date(2026, time.December, 31, 0, 0, 0, 0, time.UTC), false},
	}
	for _, testCase := range cases {
		err := accounting.EnsurePeriodOpen(db, seed.BusinessID, testCase.date)
		if testCase.blocked {
			if err == nil {
				t.Fatalf("%s (%s): expected the period to be locked", testCase.name, testCase.date.Format("2006-01-02"))
			}
			if !accounting.IsPeriodLockedError(err) {
				t.Fatalf("%s: expected a period-locked error, got %v", testCase.name, err)
			}
			continue
		}
		if err != nil {
			t.Fatalf("%s (%s): expected the period to be open, got %v", testCase.name, testCase.date.Format("2006-01-02"), err)
		}
	}
}

// A time carrying a wall clock must be treated as its date. Passing an
// afternoon timestamp on the lock date must still be blocked.
func TestPeriodLockIgnoresTimeOfDay(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)

	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = '2026-06-30' WHERE business_id = ?`,
		seed.BusinessID,
	).Error; err != nil {
		t.Fatalf("set lock: %v", err)
	}

	afternoon := time.Date(2026, time.June, 30, 16, 45, 0, 0, time.UTC)
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, afternoon); err == nil {
		t.Fatal("an afternoon on the lock date must still be locked")
	}
	nextMorning := time.Date(2026, time.July, 1, 0, 30, 0, 0, time.UTC)
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, nextMorning); err != nil {
		t.Fatalf("the morning after the lock must be open, got %v", err)
	}
}

// With no lock set, nothing is blocked. A business that has never closed its
// books must be able to post to any date.
func TestNoLockLeavesEveryDateOpen(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)

	for _, date := range []time.Time{
		time.Date(2019, time.January, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.June, 30, 0, 0, 0, 0, time.UTC),
		time.Now().UTC(),
	} {
		if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, date); err != nil {
			t.Fatalf("%s should be open with no lock set, got %v", date.Format("2006-01-02"), err)
		}
	}
}

// Clearing the lock re-opens the dates it had closed.
func TestClearingTheLockReopensThePeriod(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	backdated := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)

	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = '2026-06-30' WHERE business_id = ?`,
		seed.BusinessID,
	).Error; err != nil {
		t.Fatalf("set lock: %v", err)
	}
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, backdated); err == nil {
		t.Fatal("expected the backdated entry to be blocked")
	}

	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = NULL WHERE business_id = ?`,
		seed.BusinessID,
	).Error; err != nil {
		t.Fatalf("clear lock: %v", err)
	}
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, backdated); err != nil {
		t.Fatalf("clearing the lock must reopen the period, got %v", err)
	}
}

// The lock is per business. One business closing its books must not stop
// another posting -- these are separate tenants sharing a table.
func TestPeriodLockIsScopedToItsBusiness(t *testing.T) {
	db := testdb.Tx(t)
	locked := testdb.Seed(t, db)
	other := testdb.Seed(t, db)
	date := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)

	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = '2026-06-30' WHERE business_id = ?`,
		locked.BusinessID,
	).Error; err != nil {
		t.Fatalf("set lock: %v", err)
	}

	if err := accounting.EnsurePeriodOpen(db, locked.BusinessID, date); err == nil {
		t.Fatal("the locked business must be blocked")
	}
	if err := accounting.EnsurePeriodOpen(db, other.BusinessID, date); err != nil {
		t.Fatalf("another business must be unaffected, got %v", err)
	}
}

// The delete and reverse paths bind on the date of the journal being changed,
// not on today, so history stays immutable.
func TestEnsurePeriodOpenForJournalsBindsOnTheEntryDate(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)

	insideLock := seed.PostJournal(t, db,
		time.Date(2026, time.May, 10, 0, 0, 0, 0, time.UTC), "1000", "4000", 100)
	outsideLock := seed.PostJournal(t, db,
		time.Date(2026, time.August, 10, 0, 0, 0, 0, time.UTC), "1000", "4000", 100)

	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = '2026-06-30' WHERE business_id = ?`,
		seed.BusinessID,
	).Error; err != nil {
		t.Fatalf("set lock: %v", err)
	}

	if err := accounting.EnsurePeriodOpenForJournals(db, seed.BusinessID, insideLock); err == nil {
		t.Fatal("a journal dated inside the locked period must not be touchable")
	}
	if err := accounting.EnsurePeriodOpenForJournals(db, seed.BusinessID, outsideLock); err != nil {
		t.Fatalf("a journal dated after the lock must remain editable, got %v", err)
	}
	// Given several journals, the earliest is binding: one locked entry in the
	// set is enough to block the whole operation.
	if err := accounting.EnsurePeriodOpenForJournals(db, seed.BusinessID, outsideLock, insideLock); err == nil {
		t.Fatal("a set containing a locked journal must be blocked as a whole")
	}
}
