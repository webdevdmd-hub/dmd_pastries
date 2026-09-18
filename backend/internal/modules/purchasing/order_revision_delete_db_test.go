package purchasing

import (
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-092 — deleting a draft purchase order that had been
// revised failed with a 500.
//
// purchase_order_revisions references purchase_orders with no ON DELETE rule
// (migration 000078), and HardDeleteOrder removed the order's drafts, charges
// and items but never its revisions, so Postgres refused the final DELETE with
// a foreign-key violation. A revision is a snapshot of the order's own edits,
// and DeleteOrder only reaches HardDeleteOrder once the order has no finalized
// history, so the revisions go with the order.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
func TestARevisedDraftPurchaseOrderCanBeDeleted(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	supplierID := seeded.SeedSupplier(t, db, "QA Flour Mill")
	orderID := seedDraftPurchaseOrder(t, db, seeded, supplierID, "PO-900001")
	seedPurchaseOrderRevision(t, db, seeded, orderID, 1)

	if err := (&Repository{}).HardDeleteOrder(db, seeded.BusinessID, orderID); err != nil {
		t.Fatalf("HardDeleteOrder on a revised draft order: %v", err)
	}

	var orders, revisions int64
	db.Raw(`SELECT COUNT(*) FROM purchase_orders WHERE id = ?`, orderID).Scan(&orders)
	db.Raw(`SELECT COUNT(*) FROM purchase_order_revisions WHERE purchase_order_id = ?`, orderID).Scan(&revisions)
	if orders != 0 || revisions != 0 {
		t.Fatalf("after the delete %d order rows and %d revision rows remain, want 0 and 0", orders, revisions)
	}
}

// seedDraftPurchaseOrder inserts a draft order with no lines, which is all the
// delete path needs.
func seedDraftPurchaseOrder(t *testing.T, db *gorm.DB, seeded testdb.Seeded, supplierID, number string) string {
	t.Helper()
	id := testdb.NewUUID()
	if err := db.Exec(`INSERT INTO purchase_orders
		(id, business_id, branch_id, supplier_id, purchase_order_number, order_date, status, total_amount, created_by_user_id, updated_by_user_id)
		VALUES (?, ?, ?, ?, ?, ?, 'draft', 125, ?, ?)`,
		id, seeded.BusinessID, seeded.BranchID, supplierID, number, time.Now().UTC().Format("2006-01-02"),
		seeded.UserID, seeded.UserID).Error; err != nil {
		t.Fatalf("seed purchase order: %v", err)
	}
	return id
}

func seedPurchaseOrderRevision(t *testing.T, db *gorm.DB, seeded testdb.Seeded, orderID string, number int) {
	t.Helper()
	if err := db.Exec(`INSERT INTO purchase_order_revisions
		(id, business_id, branch_id, purchase_order_id, revision_number, reason, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, 'Quantity corrected before sending', ?)`,
		testdb.NewUUID(), seeded.BusinessID, seeded.BranchID, orderID, number, seeded.UserID).Error; err != nil {
		t.Fatalf("seed purchase order revision: %v", err)
	}
}
