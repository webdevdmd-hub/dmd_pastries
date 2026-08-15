package accounting_test

import (
	"strings"
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/testsupport/testdb"
)

// Correcting a miscategorized chart account against a real database.
//
// An account created with the wrong type used to be wrong forever: type, code
// and normal balance were immutable, which is right once the account carries
// postings and wrong before it does. These tests pin both halves — the
// correction works while the account is untouched, and every route to
// restating existing meaning stays shut.

// newUserAccount creates a non-system account and returns its id. Tests need a
// real row created the way a user creates one, not a seeded system account.
func newUserAccount(t *testing.T, service *accounting.Service, seed testdb.Seeded, code, name, accountType, group, normalBalance string) string {
	t.Helper()
	created, err := service.CreateChartAccount(seed.AuthContext(), accounting.CreateChartAccountRequest{
		BranchID:      seed.BranchID,
		AccountCode:   code,
		AccountName:   name,
		AccountType:   accountType,
		AccountGroup:  group,
		NormalBalance: normalBalance,
	}, "127.0.0.1", "test")
	if err != nil {
		t.Fatalf("create %s: %v", code, err)
	}
	return created.ID
}

func reclassifyToExpense(code string) accounting.UpdateChartAccountRequest {
	accountType := "expense"
	group := "operating_expense"
	newCode := code
	return accounting.UpdateChartAccountRequest{
		AccountType:  &accountType,
		AccountGroup: &group,
		AccountCode:  &newCode,
	}
}

// The case this whole capability exists for: an account created as the wrong
// type, never posted to, corrected in place.
func TestUnpostedAccountCanBeReclassified(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	// Created wrong: a liability that was meant to be an expense.
	id := newUserAccount(t, service, seed, "7001", "Bad debts", "liability", "current_liability", "debit")

	name := "Bad Debts Expense"
	req := reclassifyToExpense("6130")
	req.AccountName = &name
	updated, err := service.UpdateChartAccount(user, id, req, "127.0.0.1", "test")
	if err != nil {
		t.Fatalf("reclassify: %v", err)
	}

	if updated.AccountType != "expense" {
		t.Errorf("account_type = %q, want expense", updated.AccountType)
	}
	if updated.AccountCode != "6130" {
		t.Errorf("account_code = %q, want 6130", updated.AccountCode)
	}
	if updated.AccountGroup != "operating_expense" {
		t.Errorf("account_group = %q, want operating_expense", updated.AccountGroup)
	}
	if updated.AccountName != "Bad Debts Expense" {
		t.Errorf("account_name = %q, want Bad Debts Expense", updated.AccountName)
	}
	if updated.HasPostings {
		t.Error("an untouched account must not report postings")
	}
}

// Once an account carries a posting its classification is history. Changing it
// would silently restate every statement that already included it.
func TestPostedAccountCannotBeReclassified(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)

	id := newUserAccount(t, service, seed, "7002", "Misc income", "income", "other_income", "credit")
	postToAccount(t, db, seed, id)

	_, err := service.UpdateChartAccount(seed.AuthContext(), id, reclassifyToExpense("6131"), "127.0.0.1", "test")
	if err == nil {
		t.Fatal("expected reclassification of a posted account to be refused")
	}
	if !strings.Contains(err.Error(), "posted to") {
		t.Fatalf("error should name the reason, got: %v", err)
	}
}

// A soft-deleted line still means the account was used: journals are retained
// on delete for the audit trail, and reversals keep their originals. Treating
// those as unposted would let a correction restate a retained entry.
func TestSoftDeletedJournalLineStillLocksTheAccount(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)

	id := newUserAccount(t, service, seed, "7003", "Misc income", "income", "other_income", "credit")
	postToAccount(t, db, seed, id)
	if err := db.Exec(`UPDATE journal_entry_lines SET deleted_at = NOW() WHERE account_id = ?`, id).Error; err != nil {
		t.Fatalf("soft delete line: %v", err)
	}

	_, err := service.UpdateChartAccount(seed.AuthContext(), id, reclassifyToExpense("6132"), "127.0.0.1", "test")
	if err == nil {
		t.Fatal("a soft-deleted posting must still lock the classification")
	}
}

// Seeded accounts, headers, and parents of other accounts all carry meaning
// beyond themselves.
func TestAccountsThatCarryMeaningCannotBeReclassified(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	t.Run("seeded system account", func(t *testing.T) {
		id := seed.AccountID(t, db, "6010") // Rent Expense
		_, err := service.UpdateChartAccount(user, id, reclassifyToExpense("6010"), "127.0.0.1", "test")
		if err == nil || !strings.Contains(err.Error(), "system") {
			t.Fatalf("system account should be refused, got: %v", err)
		}
	})

	t.Run("header", func(t *testing.T) {
		id := seed.AccountID(t, db, "60") // Operating Expenses header
		_, err := service.UpdateChartAccount(user, id, reclassifyToExpense("60"), "127.0.0.1", "test")
		if err == nil || !strings.Contains(err.Error(), "header") {
			t.Fatalf("header should be refused, got: %v", err)
		}
	})
}

// Changing a type without saying what group the account now belongs to would
// leave pairings like expense + current_liability.
func TestTypeChangeRequiresAccountGroup(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)

	id := newUserAccount(t, service, seed, "7004", "Misc", "liability", "current_liability", "credit")

	accountType := "expense"
	_, err := service.UpdateChartAccount(seed.AuthContext(), id, accounting.UpdateChartAccountRequest{
		AccountType: &accountType,
	}, "127.0.0.1", "test")
	if err == nil || !strings.Contains(err.Error(), "account_group") {
		t.Fatalf("type change without a group should be refused, got: %v", err)
	}
}

// A parent chosen for the old type cannot silently survive a type change — the
// statements group by that relationship.
func TestTypeChangeWithStaleParentIsRefused(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	id := newUserAccount(t, service, seed, "7005", "Misc", "liability", "current_liability", "credit")
	// Park it under the Current Liabilities header first.
	liabilityHeader := seed.AccountID(t, db, "20")
	if _, err := service.UpdateChartAccount(user, id, accounting.UpdateChartAccountRequest{
		ParentAccountID: &liabilityHeader,
	}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("set parent: %v", err)
	}

	_, err := service.UpdateChartAccount(user, id, reclassifyToExpense("6133"), "127.0.0.1", "test")
	if err == nil || !strings.Contains(err.Error(), "parent_account_id") {
		t.Fatalf("stale parent should be refused, got: %v", err)
	}

	// Supplying the correct new parent in the same request resolves it.
	expenseHeader := seed.AccountID(t, db, "60")
	req := reclassifyToExpense("6133")
	req.ParentAccountID = &expenseHeader
	if _, err := service.UpdateChartAccount(user, id, req, "127.0.0.1", "test"); err != nil {
		t.Fatalf("reclassify with a matching parent: %v", err)
	}
}

// Codes are unique per branch, case-insensitively — but an account keeping its
// own code must not collide with itself.
func TestAccountCodeUniquenessOnReclassify(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)
	user := seed.AuthContext()

	id := newUserAccount(t, service, seed, "7006", "Misc", "liability", "current_liability", "credit")

	t.Run("collides with an existing code", func(t *testing.T) {
		_, err := service.UpdateChartAccount(user, id, reclassifyToExpense("6010"), "127.0.0.1", "test")
		if err == nil || !strings.Contains(err.Error(), "already exists") {
			t.Fatalf("duplicate code should conflict, got: %v", err)
		}
	})

	t.Run("keeping its own code is not a collision", func(t *testing.T) {
		if _, err := service.UpdateChartAccount(user, id, reclassifyToExpense("7006"), "127.0.0.1", "test"); err != nil {
			t.Fatalf("an account keeping its own code should be allowed: %v", err)
		}
	})
}

// Contra accounts invert the usual type/balance pairing on purpose, so nothing
// here may reject them.
func TestContraAccountsRemainValid(t *testing.T) {
	db := testdb.Connect(t)
	seed := testdb.Seed(t, db)
	service := newAccountingService(db)

	// asset with a credit balance, the shape of Accumulated Depreciation
	id := newUserAccount(t, service, seed, "7007", "Allowance for doubtful accounts", "asset", "contra_asset", "credit")

	balance := "credit"
	group := "contra_asset"
	if _, err := service.UpdateChartAccount(seed.AuthContext(), id, accounting.UpdateChartAccountRequest{
		NormalBalance: &balance,
		AccountGroup:  &group,
	}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("contra account should remain updatable: %v", err)
	}
}

// postToAccount books a balanced entry that touches accountID, so the account
// has history without depending on any posting service.
func postToAccount(t *testing.T, db *gorm.DB, seed testdb.Seeded, accountID string) {
	t.Helper()
	entryID := testdb.NewUUID()
	if err := db.Exec(`INSERT INTO journal_entries
		(id, business_id, branch_id, entry_number, entry_date, source_type, status, total_debit, total_credit, created_by_user_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, CURRENT_DATE, 'manual', 'posted', 100, 100, ?, NOW(), NOW())`,
		entryID, seed.BusinessID, seed.BranchID, "JE-"+entryID[:8], seed.UserID).Error; err != nil {
		t.Fatalf("insert journal entry: %v", err)
	}
	insertLine := func(id string, debit, credit float64, number int) {
		t.Helper()
		if err := db.Exec(`INSERT INTO journal_entry_lines
			(id, business_id, branch_id, journal_entry_id, account_id, line_number, debit_amount, credit_amount, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			testdb.NewUUID(), seed.BusinessID, seed.BranchID, entryID, id, number, debit, credit).Error; err != nil {
			t.Fatalf("insert journal line: %v", err)
		}
	}
	insertLine(seed.AccountID(t, db, "1000"), 100, 0, 1)
	insertLine(accountID, 0, 100, 2)
}
