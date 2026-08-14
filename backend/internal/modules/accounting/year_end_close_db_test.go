package accounting_test

import (
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/testsupport/testdb"
)

// Year-end close (Phase 5 / W2) against a real database.
//
// This path has the worst record in the codebase: two runtime-fatal defects
// were found in it by reading the code -- a migration writing to a table that
// does not exist, and a source key that was not a valid uuid for its column --
// and until now it had never actually executed. Every test here would have
// failed before those fixes.

func newAccountingService(db *gorm.DB) *accounting.Service {
	return accounting.NewService(db, accounting.NewRepository(db), audit.NewRepository(db))
}

// closableYear returns a financial year that has already ended, so the close
// is allowed to run.
func closableYear() (start, end time.Time, endText string) {
	year := time.Now().UTC().Year() - 1
	start = time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC)
	end = time.Date(year, time.December, 31, 0, 0, 0, 0, time.UTC)
	return start, end, end.Format("2006-01-02")
}

func accountBalance(t *testing.T, db *gorm.DB, seed testdb.Seeded, code string) float64 {
	t.Helper()
	var balance float64
	err := db.Raw(`
		SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id
		JOIN chart_of_accounts coa ON coa.id = jel.account_id
		WHERE jel.business_id = ? AND coa.account_code = ?
		  AND je.status IN ('posted','reversed')
		  AND je.deleted_at IS NULL AND jel.deleted_at IS NULL`,
		seed.BusinessID, code).Scan(&balance).Error
	if err != nil {
		t.Fatalf("balance for %s: %v", code, err)
	}
	return balance
}

// The core of it: a year with 1,000 of income and 400 of expense closes with
// 600 moved into retained earnings, and income and expense left at zero.
func TestClosingAYearMovesProfitIntoRetainedEarnings(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	start, _, endText := closableYear()

	// Dr Cash / Cr Sales Income, then Dr Rent Expense / Cr Cash.
	seed.PostJournal(t, db, start.AddDate(0, 2, 0), "1000", "4000", 1000)
	seed.PostJournal(t, db, start.AddDate(0, 5, 0), "6010", "1000", 400)

	if got := accountBalance(t, db, seed, "4000"); got != -1000 {
		t.Fatalf("income should carry a 1000 credit balance, got %v", got)
	}

	result, err := service.CloseFinancialYear(seed.AuthContext(),
		accounting.CloseFinancialYearRequest{FinancialYearEndDate: endText}, "127.0.0.1", "test")
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if len(result.Branches) != 1 {
		t.Fatalf("expected one branch closed, got %d", len(result.Branches))
	}
	if result.Branches[0].NetProfit != 600 {
		t.Fatalf("net profit = %v, want 600", result.Branches[0].NetProfit)
	}

	// Income and expense are zeroed; the profit lands in 3100.
	if got := accountBalance(t, db, seed, "4000"); got != 0 {
		t.Fatalf("income should be zero after the close, got %v", got)
	}
	if got := accountBalance(t, db, seed, "6010"); got != 0 {
		t.Fatalf("expense should be zero after the close, got %v", got)
	}
	// 3100 is credit-normal, so a profit shows as a negative debit-minus-credit.
	if got := accountBalance(t, db, seed, "3100"); got != -600 {
		t.Fatalf("retained earnings should carry 600, got %v", got)
	}
}

// The close journal must balance. An unbalanced entry is the one thing a
// ledger can never carry.
func TestCloseJournalIsBalancedAndDatedAtTheYearEnd(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	start, end, endText := closableYear()

	seed.PostJournal(t, db, start.AddDate(0, 3, 0), "1000", "4000", 777.77)
	seed.PostJournal(t, db, start.AddDate(0, 4, 0), "6010", "1000", 123.45)

	if _, err := service.CloseFinancialYear(seed.AuthContext(),
		accounting.CloseFinancialYearRequest{FinancialYearEndDate: endText}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("close: %v", err)
	}

	var row struct {
		EntryDate   time.Time
		TotalDebit  float64
		TotalCredit float64
		SumDebit    float64
		SumCredit   float64
	}
	if err := db.Raw(`
		SELECT je.entry_date, je.total_debit, je.total_credit,
		       COALESCE(SUM(jel.debit_amount),0) AS sum_debit,
		       COALESCE(SUM(jel.credit_amount),0) AS sum_credit
		FROM journal_entries je
		JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.deleted_at IS NULL
		WHERE je.business_id = ? AND je.source_type = 'year_end_close' AND je.deleted_at IS NULL
		GROUP BY je.id, je.entry_date, je.total_debit, je.total_credit`,
		seed.BusinessID).Scan(&row).Error; err != nil {
		t.Fatalf("read close journal: %v", err)
	}

	if row.SumDebit != row.SumCredit {
		t.Fatalf("close journal does not balance: debits %v, credits %v", row.SumDebit, row.SumCredit)
	}
	if row.TotalDebit != row.SumDebit || row.TotalCredit != row.SumCredit {
		t.Fatalf("header totals (%v/%v) disagree with the lines (%v/%v)",
			row.TotalDebit, row.TotalCredit, row.SumDebit, row.SumCredit)
	}
	if !row.EntryDate.UTC().Truncate(24 * time.Hour).Equal(end) {
		t.Fatalf("close journal dated %s, want %s", row.EntryDate.Format("2006-01-02"), end.Format("2006-01-02"))
	}
}

// The close writes source_id into a uuid column. This is the defect that
// shipped: a readable "<branch>-FY2025" key is rejected by Postgres outright,
// so every close failed.
func TestCloseSourceIDIsAcceptedByTheUUIDColumn(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	start, _, endText := closableYear()

	seed.PostJournal(t, db, start.AddDate(0, 1, 0), "1000", "4000", 500)

	if _, err := service.CloseFinancialYear(seed.AuthContext(),
		accounting.CloseFinancialYearRequest{FinancialYearEndDate: endText}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("close failed -- the source key is not valid for its column: %v", err)
	}
	var sourceID string
	if err := db.Raw(`SELECT source_id::text FROM journal_entries
		WHERE business_id = ? AND source_type = 'year_end_close' AND deleted_at IS NULL`,
		seed.BusinessID).Scan(&sourceID).Error; err != nil {
		t.Fatalf("read source id: %v", err)
	}
	if sourceID == "" {
		t.Fatal("the close journal carries no source id, so it cannot be idempotent")
	}
}

// Closing extends the lock to the year end, which is what makes the closed
// year immutable.
func TestClosingLocksTheYearItClosed(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	start, end, endText := closableYear()

	seed.PostJournal(t, db, start.AddDate(0, 6, 0), "1000", "4000", 250)

	insideYear := start.AddDate(0, 6, 0)
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, insideYear); err != nil {
		t.Fatalf("the year should be open before the close: %v", err)
	}
	if _, err := service.CloseFinancialYear(seed.AuthContext(),
		accounting.CloseFinancialYearRequest{FinancialYearEndDate: endText}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("close: %v", err)
	}
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, insideYear); err == nil {
		t.Fatal("the closed year must be locked against further postings")
	}
	// The day after the year end stays open, or the business could not trade.
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, end.AddDate(0, 0, 1)); err != nil {
		t.Fatalf("the day after the year end must remain open, got %v", err)
	}
}

// Re-closing an already closed year must not post a second close journal or
// double retained earnings.
//
// It is a silent no-op rather than a refusal: nothing validates that the year
// is already closed, so the guard is the idempotency index from migration
// 000096, which makes the second post return the first journal. The safety
// property holds, but the caller gets a success response quoting a net profit
// as though it had closed again -- worth knowing before wiring a Close button
// to it.
func TestReClosingAYearDoesNotDoubleRetainedEarnings(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	start, _, endText := closableYear()

	seed.PostJournal(t, db, start.AddDate(0, 2, 0), "1000", "4000", 900)
	request := accounting.CloseFinancialYearRequest{FinancialYearEndDate: endText}

	if _, err := service.CloseFinancialYear(seed.AuthContext(), request, "127.0.0.1", "test"); err != nil {
		t.Fatalf("first close: %v", err)
	}
	// Whether this refuses or no-ops, what must never happen is a second
	// close journal.
	_, _ = service.CloseFinancialYear(seed.AuthContext(), request, "127.0.0.1", "test")

	var closeJournals int64
	if err := db.Raw(`SELECT COUNT(*) FROM journal_entries
		WHERE business_id = ? AND source_type = 'year_end_close' AND deleted_at IS NULL`,
		seed.BusinessID).Scan(&closeJournals).Error; err != nil {
		t.Fatalf("count close journals: %v", err)
	}
	if closeJournals != 1 {
		t.Fatalf("expected exactly one close journal, found %d", closeJournals)
	}
	if got := accountBalance(t, db, seed, "3100"); got != -900 {
		t.Fatalf("retained earnings should still be 900, got %v", got)
	}
}

// Reopening rolls the lock back and removes the close journal, so the year can
// be corrected and closed again. It soft-deletes rather than reversing,
// because a reversed journal would hold the idempotency slot forever and make
// re-closing impossible -- which this test proves by re-closing.
func TestReopeningAllowsTheYearToBeClosedAgain(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	start, _, endText := closableYear()

	seed.PostJournal(t, db, start.AddDate(0, 2, 0), "1000", "4000", 800)
	request := accounting.CloseFinancialYearRequest{FinancialYearEndDate: endText}

	if _, err := service.CloseFinancialYear(seed.AuthContext(), request, "127.0.0.1", "test"); err != nil {
		t.Fatalf("close: %v", err)
	}
	if _, err := service.ReopenFinancialYear(seed.AuthContext(), request, "127.0.0.1", "test"); err != nil {
		t.Fatalf("reopen: %v", err)
	}

	// The year is postable again and retained earnings is back to nothing.
	if err := accounting.EnsurePeriodOpen(db, seed.BusinessID, start.AddDate(0, 2, 0)); err != nil {
		t.Fatalf("reopening must unlock the year, got %v", err)
	}
	if got := accountBalance(t, db, seed, "3100"); got != 0 {
		t.Fatalf("retained earnings should be cleared by the reopen, got %v", got)
	}

	// And the year can be closed again, which a reversal-based reopen would
	// have made impossible.
	if _, err := service.CloseFinancialYear(seed.AuthContext(), request, "127.0.0.1", "test"); err != nil {
		t.Fatalf("re-closing after a reopen must work: %v", err)
	}
	if got := accountBalance(t, db, seed, "3100"); got != -800 {
		t.Fatalf("retained earnings after re-closing = %v, want 800", got)
	}
}

// A year that has not finished yet cannot be closed.
func TestClosingAnIncompleteYearIsRefused(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)

	currentYearEnd := time.Date(time.Now().UTC().Year(), time.December, 31, 0, 0, 0, 0, time.UTC)
	_, err := service.CloseFinancialYear(seed.AuthContext(),
		accounting.CloseFinancialYearRequest{FinancialYearEndDate: currentYearEnd.Format("2006-01-02")},
		"127.0.0.1", "test")
	if err == nil {
		t.Fatal("closing a financial year that has not ended must be refused")
	}
}

// The close date has to be a real financial-year boundary for this business,
// not an arbitrary date.
func TestClosingOnANonBoundaryDateIsRefused(t *testing.T) {
	// The close manages its own transaction, so this needs a committed
	// connection; testdb.Seed removes what it creates.
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)

	_, err := service.CloseFinancialYear(seed.AuthContext(),
		accounting.CloseFinancialYearRequest{
			FinancialYearEndDate: time.Date(time.Now().UTC().Year()-1, time.June, 30, 0, 0, 0, 0, time.UTC).Format("2006-01-02"),
		}, "127.0.0.1", "test")
	if err == nil {
		t.Fatal("a mid-year date is not a financial year end and must be refused")
	}
}
