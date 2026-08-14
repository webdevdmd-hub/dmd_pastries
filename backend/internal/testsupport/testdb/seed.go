package testdb

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/shared/utils"
)

// Seeded is a business with everything the accounting paths need in place:
// a branch, a user with full branch access, company settings (which carry the
// financial year), and a real seeded chart of accounts with its mappings.
type Seeded struct {
	BusinessID string
	BranchID   string
	UserID     string
	RoleID     string
}

// AuthContext returns an authenticated context for the seeded owner, with
// access to every branch.
func (s Seeded) AuthContext() *utils.AuthContext {
	branchID := s.BranchID
	return &utils.AuthContext{
		UserID:               s.UserID,
		BusinessID:           s.BusinessID,
		RoleID:               s.RoleID,
		RoleName:             "Admin",
		FullName:             "Test Owner",
		Email:                "owner@example.test",
		CurrentBranchID:      &branchID,
		AllowedBranchIDs:     []string{s.BranchID},
		CanAccessAllBranches: true,
	}
}

// NewUUID is exported so tests can mint ids without importing uuid directly.
func NewUUID() string { return uuid.NewString() }

// Seed builds a business ready to post accounting entries.
//
// It runs the real chart-of-accounts and account-mapping seeders rather than
// inserting a hand-picked subset, so tests exercise the same 75-account chart
// production gets -- and so a change to the seed list shows up here.
//
// Everything it creates is removed when the test finishes, so it is safe on a
// committed connection as well as inside a rolled-back transaction.
func Seed(t *testing.T, db *gorm.DB) Seeded {
	t.Helper()

	seed := Seeded{
		BusinessID: NewUUID(),
		BranchID:   NewUUID(),
		UserID:     NewUUID(),
		RoleID:     NewUUID(),
	}
	suffix := seed.BusinessID[:8]

	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed: %v", err)
		}
	}

	exec(`INSERT INTO businesses (id, business_name, currency, timezone) VALUES (?, ?, 'AED', 'Asia/Dubai')`,
		seed.BusinessID, "Test Business "+suffix)
	exec(`INSERT INTO branches (id, business_id, branch_name, name, code) VALUES (?, ?, ?, ?, ?)`,
		seed.BranchID, seed.BusinessID, "Main Branch", "Main Branch", "MB-"+suffix)
	exec(`INSERT INTO roles (id, business_id, role_name, is_system_default) VALUES (?, ?, 'Admin', true)`,
		seed.RoleID, seed.BusinessID)
	exec(`INSERT INTO users (id, appwrite_user_id, business_id, role_id, full_name, email) VALUES (?, ?, ?, ?, ?, ?)`,
		seed.UserID, "appwrite-"+suffix, seed.BusinessID, seed.RoleID, "Test Owner", "owner-"+suffix+"@example.test")
	// The financial year lives here, so the year-end close cannot resolve a
	// year without it. Default: 1 January.
	exec(`INSERT INTO company_settings (id, business_id, business_display_name, currency, timezone, financial_year_start_month, financial_year_start_day)
	      VALUES (?, ?, ?, 'AED', 'Asia/Dubai', 1, 1)`,
		NewUUID(), seed.BusinessID, "Test Business "+suffix)

	if err := accounting.SeedDefaultChartOfAccounts(db, seed.BusinessID, seed.BranchID); err != nil {
		t.Fatalf("seed chart of accounts: %v", err)
	}
	if err := accounting.SeedDefaultAccountMappings(db, seed.BusinessID, seed.BranchID); err != nil {
		t.Fatalf("seed account mappings: %v", err)
	}

	t.Cleanup(func() { removeBusiness(db, seed.BusinessID) })
	return seed
}

// removeBusiness deletes a seeded business and everything hanging off it, in
// foreign-key order. Tests that commit would otherwise leave the test database
// growing; inside a rolled-back transaction this is simply redundant.
//
// Errors are ignored on purpose: a rolled-back or closed transaction makes
// these statements fail harmlessly, and a cleanup failure must not mask the
// result of the test itself.
func removeBusiness(db *gorm.DB, businessID string) {
	statements := []string{
		`DELETE FROM journal_entry_lines WHERE business_id = ?`,
		`DELETE FROM journal_entries WHERE business_id = ?`,
		`DELETE FROM counterparty_opening_balances WHERE business_id = ?`,
		`DELETE FROM customers WHERE business_id = ?`,
		`DELETE FROM suppliers WHERE business_id = ?`,
		`DELETE FROM chart_account_opening_balances WHERE business_id = ?`,
		`DELETE FROM accounting_account_mappings WHERE business_id = ?`,
		`DELETE FROM chart_of_accounts WHERE business_id = ?`,
		`DELETE FROM company_settings WHERE business_id = ?`,
		`DELETE FROM users WHERE business_id = ?`,
		`DELETE FROM roles WHERE business_id = ?`,
		`DELETE FROM branches WHERE business_id = ?`,
		`DELETE FROM businesses WHERE id = ?`,
	}
	for _, statement := range statements {
		_ = db.Exec(statement, businessID).Error
	}
}

// AccountID looks up a seeded chart account by its code.
func (s Seeded) AccountID(t *testing.T, db *gorm.DB, code string) string {
	t.Helper()
	var id string
	err := db.Raw(
		`SELECT id FROM chart_of_accounts WHERE business_id = ? AND branch_id = ? AND account_code = ? AND deleted_at IS NULL`,
		s.BusinessID, s.BranchID, code,
	).Scan(&id).Error
	if err != nil {
		t.Fatalf("look up account %s: %v", code, err)
	}
	if id == "" {
		t.Fatalf("seeded chart of accounts has no account %s", code)
	}
	return id
}

// PostJournal writes a balanced two-line posted journal directly, so a test
// can create the ledger history a close or a lock needs without driving a
// whole domain flow.
func (s Seeded) PostJournal(t *testing.T, db *gorm.DB, entryDate time.Time, debitCode, creditCode string, amount float64) string {
	t.Helper()
	entryID := NewUUID()
	now := time.Now().UTC()

	if err := db.Exec(`INSERT INTO journal_entries
		(id, business_id, branch_id, entry_number, entry_date, source_type, status, total_debit, total_credit, created_by_user_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'pos_sale', 'posted', ?, ?, ?, ?, ?)`,
		entryID, s.BusinessID, s.BranchID, "JE-"+entryID[:8], entryDate.Format("2006-01-02"),
		amount, amount, s.UserID, now, now).Error; err != nil {
		t.Fatalf("insert journal entry: %v", err)
	}

	line := func(accountID string, debit, credit float64, number int) {
		t.Helper()
		if err := db.Exec(`INSERT INTO journal_entry_lines
			(id, business_id, branch_id, journal_entry_id, account_id, line_number, debit_amount, credit_amount, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			NewUUID(), s.BusinessID, s.BranchID, entryID, accountID, number, debit, credit, now, now).Error; err != nil {
			t.Fatalf("insert journal line: %v", err)
		}
	}
	line(s.AccountID(t, db, debitCode), amount, 0, 1)
	line(s.AccountID(t, db, creditCode), 0, amount, 2)
	return entryID
}

// SeedCustomer creates a customer in the seeded branch and returns its id.
func (s Seeded) SeedCustomer(t *testing.T, db *gorm.DB, name string) string {
	t.Helper()
	id := NewUUID()
	if err := db.Exec(
		`INSERT INTO customers (id, business_id, branch_id, customer_code, full_name, created_by_user_id)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id, s.BusinessID, s.BranchID, "CUST-"+id[:8], name, s.UserID).Error; err != nil {
		t.Fatalf("seed customer: %v", err)
	}
	return id
}

// SeedSupplier creates a supplier in the seeded branch and returns its id.
func (s Seeded) SeedSupplier(t *testing.T, db *gorm.DB, name string) string {
	t.Helper()
	id := NewUUID()
	if err := db.Exec(
		`INSERT INTO suppliers (id, business_id, branch_id, supplier_code, supplier_name, created_by_user_id)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id, s.BusinessID, s.BranchID, "SUP-"+id[:8], name, s.UserID).Error; err != nil {
		t.Fatalf("seed supplier: %v", err)
	}
	return id
}
