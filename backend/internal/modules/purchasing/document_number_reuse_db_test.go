package purchasing

import (
	"os"
	"path/filepath"
	"testing"

	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-082 — deleting the newest draft purchase order handed its
// number to the next order.
//
// Numbers were MAX(existing)+1 over the rows that still exist, and a draft
// order (with its draft bills, receipts and vendor credits) is hard-deleted.
// Delete PO-000002 and the next order was PO-000002 again, so a number already
// sent to a supplier could come back on a different order. The same held for
// the PI-, PR- and VC- sequences.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestADeletedPurchaseOrderNumberIsNeverIssuedAgain(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	supplierID := seeded.SeedSupplier(t, db, "QA Egg Farm")
	repo := &Repository{}

	issue := func() string {
		t.Helper()
		number, err := repo.NextNumber(db, seeded.BusinessID, "purchase_orders", "purchase_order_number", "PO", "purchase_orders")
		if err != nil {
			t.Fatalf("NextNumber: %v", err)
		}
		return number
	}

	first := issue()
	seedDraftPurchaseOrder(t, db, seeded, supplierID, first)
	second := issue()
	secondID := seedDraftPurchaseOrder(t, db, seeded, supplierID, second)
	if first != "PO-000001" || second != "PO-000002" {
		t.Fatalf("a new business issued %s then %s, want PO-000001 then PO-000002", first, second)
	}

	if err := repo.HardDeleteOrder(db, seeded.BusinessID, secondID); err != nil {
		t.Fatalf("HardDeleteOrder: %v", err)
	}
	if third := issue(); third != "PO-000003" {
		t.Fatalf("after %s was deleted the next order got %s, want PO-000003: a deleted number was reissued", second, third)
	}
}

// Numbers deleted before the counter existed are not reissued either: the
// migration seeds each business's counter from the numbers its audit log
// recorded when the documents were created. Re-running it is harmless.
func TestTheCounterMigrationRemembersNumbersDeletedBeforeIt(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)

	// PO-000041 was created (and audited) and later hard-deleted: no row left.
	if err := db.Exec(`INSERT INTO audit_logs
		(id, business_id, user_id, module_name, action_type, reference_id, actor_user_id, event_type, entity_type, entity_id, summary, metadata)
		VALUES (?, ?, ?, 'purchase_order', 'purchase_order.created', ?, ?, 'purchase_order.created', 'purchase_order', ?, 'Purchase order created',
		        '{"document_number": "PO-000041", "purchase_order_number": "PO-000041"}'::jsonb)`,
		testdb.NewUUID(), seeded.BusinessID, seeded.UserID, testdb.NewUUID(), seeded.UserID, testdb.NewUUID()).Error; err != nil {
		t.Fatalf("seed audit entry: %v", err)
	}

	migration, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", "000122_purchasing_document_number_counters.sql"))
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	for run := 0; run < 2; run++ {
		if err := db.Exec(string(migration)).Error; err != nil {
			t.Fatalf("run migration (pass %d): %v", run+1, err)
		}
	}

	number, err := (&Repository{}).NextNumber(db, seeded.BusinessID, "purchase_orders", "purchase_order_number", "PO", "purchase_orders")
	if err != nil {
		t.Fatalf("NextNumber: %v", err)
	}
	if number != "PO-000042" {
		t.Fatalf("with PO-000041 in the audit log the next order got %s, want PO-000042", number)
	}
}
