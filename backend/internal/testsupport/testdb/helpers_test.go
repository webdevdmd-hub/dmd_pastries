package testdb_test

import (
	"testing"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// seededBranch is the minimum set of rows an expense's foreign keys demand:
// a business, a branch, a user (and the role it points at), and the two chart
// accounts an expense posts between.
type seededBranch struct {
	BusinessID           string
	BranchID             string
	UserID               string
	ExpenseAccountID     string
	PaidThroughAccountID string
}

func newUUID() string { return uuid.NewString() }

func seedBranch(t *testing.T, db *gorm.DB) seededBranch {
	t.Helper()

	seed := seededBranch{
		BusinessID:           newUUID(),
		BranchID:             newUUID(),
		UserID:               newUUID(),
		ExpenseAccountID:     newUUID(),
		PaidThroughAccountID: newUUID(),
	}
	roleID := newUUID()
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
		seed.BranchID, seed.BusinessID, "Test Branch", "Test Branch", "TB-"+suffix)
	exec(`INSERT INTO roles (id, business_id, role_name) VALUES (?, ?, 'Owner')`,
		roleID, seed.BusinessID)
	exec(`INSERT INTO users (id, appwrite_user_id, business_id, role_id, full_name, email) VALUES (?, ?, ?, ?, ?, ?)`,
		seed.UserID, "appwrite-"+suffix, seed.BusinessID, roleID, "Test User", "test-"+suffix+"@example.com")

	account := func(id, code, name, accountType, group, normal string) {
		exec(`INSERT INTO chart_of_accounts
			(id, business_id, branch_id, account_code, account_name, account_type, account_group, normal_balance)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, seed.BusinessID, seed.BranchID, code, name, accountType, group, normal)
	}
	account(seed.ExpenseAccountID, "6010", "Rent Expense", "expense", "operating_expense", "debit")
	account(seed.PaidThroughAccountID, "1000", "Cash in Hand", "asset", "current_asset", "debit")

	return seed
}
