package users

import (
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/userhistory"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-075 — Staff > Delete never erased anyone: it hid the row
// and kept the login. The erase path runs against real Postgres here because
// it is destructive and leans on two database behaviours a dry run cannot
// show: a savepoint that survives a foreign-key violation, and the cascade
// on user_branch_access.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func seedStaff(t *testing.T, db *gorm.DB, seed testdb.Seeded, name string) string {
	t.Helper()
	id := testdb.NewUUID()
	if err := db.Exec(`INSERT INTO users (id, supabase_user_id, business_id, role_id, full_name, email, status)
		VALUES (?, ?, ?, ?, ?, ?, 'active')`,
		id, testdb.NewUUID(), seed.BusinessID, seed.RoleID, name, id[:8]+"@example.test").Error; err != nil {
		t.Fatalf("seed staff: %v", err)
	}
	if err := db.Exec(`INSERT INTO user_branch_access (id, business_id, user_id, branch_id) VALUES (?, ?, ?, ?)`,
		testdb.NewUUID(), seed.BusinessID, id, seed.BranchID).Error; err != nil {
		t.Fatalf("seed branch access: %v", err)
	}
	return id
}

func countRows(t *testing.T, db *gorm.DB, query string, args ...interface{}) int64 {
	t.Helper()
	var count int64
	if err := db.Raw(query, args...).Scan(&count).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	return count
}

func TestStaffWithNoHistoryIsErased(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	staff := seedStaff(t, db, seed, "New Hire")

	if has, err := userhistory.Has(db, staff); err != nil || has {
		t.Fatalf("a brand new user must have no history, got %v (%v)", has, err)
	}
	erased, err := (&Repository{}).HardDeleteByBusinessID(db, staff, seed.BusinessID)
	if err != nil || !erased {
		t.Fatalf("HardDeleteByBusinessID = %v, %v; want erased", erased, err)
	}
	if n := countRows(t, db, "SELECT count(*) FROM users WHERE id = ?", staff); n != 0 {
		t.Fatal("the user row is still in the database")
	}
	if n := countRows(t, db, "SELECT count(*) FROM user_branch_access WHERE user_id = ?", staff); n != 0 {
		t.Fatal("the user's branch access is still in the database")
	}
}

func TestStaffWithHistoryFallsBackToKeepingTheRecord(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	staff := seedStaff(t, db, seed, "Long Timer")
	// A customer they created: a foreign key the business must keep.
	if err := db.Exec(`INSERT INTO customers (id, business_id, branch_id, customer_code, full_name, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, ?)`,
		testdb.NewUUID(), seed.BusinessID, seed.BranchID, "CUST-"+staff[:8], "Walk-in", staff).Error; err != nil {
		t.Fatalf("seed customer: %v", err)
	}

	if has, err := userhistory.Has(db, staff); err != nil || !has {
		t.Fatalf("a user who created a customer must have history, got %v (%v)", has, err)
	}

	// Even if the history check were skipped, the foreign key must not fail
	// the delete: the savepoint rolls back and the caller keeps the record.
	erased, err := (&Repository{}).HardDeleteByBusinessID(db, staff, seed.BusinessID)
	if err != nil || erased {
		t.Fatalf("HardDeleteByBusinessID = %v, %v; want kept without error", erased, err)
	}
	if n := countRows(t, db, "SELECT count(*) FROM users WHERE id = ?", staff); n != 1 {
		t.Fatal("the user with history was erased")
	}
	// The transaction is still usable after the rolled-back savepoint.
	if err := (&Repository{}).ClearProviderIDs(db, staff); err != nil {
		t.Fatalf("ClearProviderIDs after the savepoint: %v", err)
	}
	if n := countRows(t, db, "SELECT count(*) FROM users WHERE id = ? AND supabase_user_id IS NULL AND appwrite_user_id IS NULL", staff); n != 1 {
		t.Fatal("the kept record still points at a login that no longer exists")
	}
}
