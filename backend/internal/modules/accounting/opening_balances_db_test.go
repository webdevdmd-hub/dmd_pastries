package accounting_test

import (
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/testsupport/testdb"
)

// Opening balances (Phase 6 / W1) against a real database.
//
// Every opening books against 3400 Opening Balance Equity, so the property
// that matters most is the one asserted repeatedly below: after entering a
// full set of openings, 3400 nets to zero. If it does not, the opening trial
// balance does not balance and the business starts its books wrong.

const openingDate = "2026-01-01"

func openingRequest(accountID string, amount float64) accounting.SaveChartAccountOpeningRequest {
	return accounting.SaveChartAccountOpeningRequest{
		ChartAccountID: accountID,
		Amount:         amount,
		OpeningDate:    openingDate,
	}
}

func liveJournalCount(t *testing.T, db *gorm.DB, businessID, sourceType string) int64 {
	t.Helper()
	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM journal_entries
		WHERE business_id = ? AND source_type = ? AND deleted_at IS NULL`,
		businessID, sourceType).Scan(&count).Error; err != nil {
		t.Fatalf("count %s journals: %v", sourceType, err)
	}
	return count
}

// An asset opening debits the asset and credits 3400; a liability opening is
// the mirror. Getting this backwards would invert the balance sheet.
func TestChartAccountOpeningPostsInTheAccountsNormalDirection(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	// 1500 Prepaid Expenses is debit-normal, 2800 Bank Loan credit-normal.
	if _, err := service.SaveChartAccountOpening(user,
		openingRequest(seed.AccountID(t, db, "1500"), 5000), "127.0.0.1", "test"); err != nil {
		t.Fatalf("save asset opening: %v", err)
	}
	if _, err := service.SaveChartAccountOpening(user,
		openingRequest(seed.AccountID(t, db, "2800"), 20000), "127.0.0.1", "test"); err != nil {
		t.Fatalf("save liability opening: %v", err)
	}

	if got := accountBalance(t, db, seed, "1500"); got != 5000 {
		t.Fatalf("prepaid expenses should be debited 5000, got %v", got)
	}
	if got := accountBalance(t, db, seed, "2800"); got != -20000 {
		t.Fatalf("bank loan should be credited 20000, got %v", got)
	}
	// 3400 carries the other side of both: credited 5000, debited 20000.
	if got := accountBalance(t, db, seed, "3400"); got != 15000 {
		t.Fatalf("opening balance equity should be 15000 debit, got %v", got)
	}
}

// A customer opening is a receivable, a supplier opening a payable. These post
// to control accounts that no journal line can attribute, which is why the
// subledger exists.
func TestCounterpartyOpeningsPostToTheControlAccounts(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	customerID := seed.SeedCustomer(t, db, "Acme Cafe")
	supplierID := seed.SeedSupplier(t, db, "Flour Supplies")

	if _, err := service.SaveCounterpartyOpening(user, accounting.SaveCounterpartyOpeningRequest{
		PartyType: "customer", PartyID: customerID, Amount: 1200, OpeningDate: openingDate,
	}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("save customer opening: %v", err)
	}
	if _, err := service.SaveCounterpartyOpening(user, accounting.SaveCounterpartyOpeningRequest{
		PartyType: "supplier", PartyID: supplierID, Amount: 800, OpeningDate: openingDate,
	}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("save supplier opening: %v", err)
	}

	if got := accountBalance(t, db, seed, "1100"); got != 1200 {
		t.Fatalf("accounts receivable should be debited 1200, got %v", got)
	}
	if got := accountBalance(t, db, seed, "2000"); got != -800 {
		t.Fatalf("accounts payable should be credited 800, got %v", got)
	}
	// 3400 takes both other sides: credited 1200, debited 800.
	if got := accountBalance(t, db, seed, "3400"); got != -400 {
		t.Fatalf("opening balance equity should be 400 credit, got %v", got)
	}
}

// Editing an opening reposts rather than stacking a correction, so exactly one
// journal must remain live and the ledger must show only the new figure.
func TestEditingAnOpeningLeavesExactlyOneLiveJournal(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()
	accountID := seed.AccountID(t, db, "1500")

	if _, err := service.SaveChartAccountOpening(user, openingRequest(accountID, 5000), "127.0.0.1", "test"); err != nil {
		t.Fatalf("first save: %v", err)
	}
	if _, err := service.SaveChartAccountOpening(user, openingRequest(accountID, 6000), "127.0.0.1", "test"); err != nil {
		t.Fatalf("edit: %v", err)
	}

	if got := liveJournalCount(t, db, seed.BusinessID, "account_opening_balance"); got != 1 {
		t.Fatalf("expected one live opening journal after an edit, found %d", got)
	}
	if got := accountBalance(t, db, seed, "1500"); got != 6000 {
		t.Fatalf("the ledger should show only the edited figure 6000, got %v", got)
	}
	if got := accountBalance(t, db, seed, "3400"); got != -6000 {
		t.Fatalf("3400 should mirror only the edited figure, got %v", got)
	}
}

// Setting an opening to zero removes it, and 3400 must return to where it was
// rather than stranding a balance.
func TestZeroingAnOpeningClearsItsJournal(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()
	accountID := seed.AccountID(t, db, "1500")

	if _, err := service.SaveChartAccountOpening(user, openingRequest(accountID, 5000), "127.0.0.1", "test"); err != nil {
		t.Fatalf("save: %v", err)
	}
	if _, err := service.SaveChartAccountOpening(user, openingRequest(accountID, 0), "127.0.0.1", "test"); err != nil {
		t.Fatalf("zero: %v", err)
	}

	if got := liveJournalCount(t, db, seed.BusinessID, "account_opening_balance"); got != 0 {
		t.Fatalf("zeroing an opening must leave no live journal, found %d", got)
	}
	if got := accountBalance(t, db, seed, "3400"); got != 0 {
		t.Fatalf("3400 must not strand a balance, got %v", got)
	}
	var rows int64
	if err := db.Raw(`SELECT COUNT(*) FROM chart_account_opening_balances
		WHERE business_id = ? AND deleted_at IS NULL`, seed.BusinessID).Scan(&rows).Error; err != nil {
		t.Fatalf("count opening rows: %v", err)
	}
	if rows != 0 {
		t.Fatalf("a zeroed opening must not leave a row, found %d", rows)
	}
}

// The point of the whole screen: enter a complete opening trial balance and
// 3400 nets to zero.
func TestACompleteOpeningTrialBalanceNetsOpeningEquityToZero(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	// Assets 9,000 against liabilities 4,000 and owner capital 5,000.
	for code, amount := range map[string]float64{
		"1500": 3000, // prepaid expenses
		"1800": 6000, // furniture and fixtures
		"2800": 4000, // bank loan
		"3000": 5000, // owner capital
	} {
		if _, err := service.SaveChartAccountOpening(user,
			openingRequest(seed.AccountID(t, db, code), amount), "127.0.0.1", "test"); err != nil {
			t.Fatalf("opening for %s: %v", code, err)
		}
	}

	summary, err := service.GetOpeningBalanceSummary(user, seed.BranchID)
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if summary.UnallocatedOpeningEquity != 0 {
		t.Fatalf("a balanced opening set must leave 3400 at zero, got %v", summary.UnallocatedOpeningEquity)
	}
	if !summary.IsBalanced {
		t.Fatal("the summary must report a balanced opening set as balanced")
	}
	if got := accountBalance(t, db, seed, "3400"); got != 0 {
		t.Fatalf("3400 in the ledger should be zero, got %v", got)
	}
}

// An unbalanced set must report exactly what is left to account for, since
// that figure is what an operator works down to zero at go-live.
func TestTheSummaryReportsWhatIsStillUnaccountedFor(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	if _, err := service.SaveChartAccountOpening(user,
		openingRequest(seed.AccountID(t, db, "1500"), 2500), "127.0.0.1", "test"); err != nil {
		t.Fatalf("save: %v", err)
	}
	summary, err := service.GetOpeningBalanceSummary(user, seed.BranchID)
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if summary.UnallocatedOpeningEquity != 2500 {
		t.Fatalf("expected 2500 still unaccounted for, got %v", summary.UnallocatedOpeningEquity)
	}
	if summary.IsBalanced {
		t.Fatal("an incomplete opening set must not report as balanced")
	}
}

// Accounts with their own opening mechanism are refused, because two paths
// crediting 3400 for the same money would double the equity side.
func TestAccountsWithTheirOwnMechanismAreRefused(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	for _, code := range []string{"1100", "2000", "1200", "3400"} {
		_, err := service.SaveChartAccountOpening(user,
			openingRequest(seed.AccountID(t, db, code), 1000), "127.0.0.1", "test")
		if err == nil {
			t.Fatalf("account %s must not accept a generic opening balance", code)
		}
	}
	if got := accountBalance(t, db, seed, "3400"); got != 0 {
		t.Fatalf("a refused opening must post nothing, got %v in 3400", got)
	}
}

// An opening dated inside a closed period must be refused: the whole point of
// the lock is that filed history cannot move.
func TestOpeningInsideALockedPeriodIsRefused(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	lockDate := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	if err := db.Exec(
		`UPDATE company_settings SET books_closed_through = ? WHERE business_id = ?`,
		lockDate, seed.BusinessID,
	).Error; err != nil {
		t.Fatalf("set lock: %v", err)
	}

	_, err := service.SaveChartAccountOpening(user,
		openingRequest(seed.AccountID(t, db, "1500"), 5000), "127.0.0.1", "test")
	if err == nil {
		t.Fatal("an opening dated inside a locked period must be refused")
	}
	if !accounting.IsPeriodLockedError(err) {
		t.Fatalf("expected a period-locked error, got %v", err)
	}
}
