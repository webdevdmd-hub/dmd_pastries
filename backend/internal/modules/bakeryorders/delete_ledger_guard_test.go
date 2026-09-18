package bakeryorders

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-097 — a bakery order whose cost of sales was posted could
// still be deleted.
//
// DeleteOrder refused a completed order, recorded payments and a revenue
// journal, but not a COGS journal or stock movements. A zero-total order
// posts no revenue journal but does relieve stock and post COGS when it is
// completed; cancelled, it passed every check and was deleted, leaving COGS
// journals and stock movements pointing at an order that no longer exists.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestAnOrderThatMovedStockOrPostedCostIsNotDeleted(t *testing.T) {
	journal := "je-1"
	cases := []struct {
		name    string
		order   BakeryOrder
		history bakeryOrderLedgerHistory
	}{
		{"a COGS journal on the order", BakeryOrder{OrderStatus: "cancelled", COGSJournalEntryID: &journal}, bakeryOrderLedgerHistory{}},
		{"a COGS reversal on the order", BakeryOrder{OrderStatus: "cancelled", COGSReversalJournalID: &journal}, bakeryOrderLedgerHistory{}},
		{"a journal keyed to the order", BakeryOrder{OrderStatus: "cancelled"}, bakeryOrderLedgerHistory{Journals: 1}},
		{"stock movements", BakeryOrder{OrderStatus: "cancelled"}, bakeryOrderLedgerHistory{StockMovements: 2}},
	}
	for _, tc := range cases {
		err := bakeryOrderLedgerRefusal(&tc.order, tc.history)
		var appErr *apperrors.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
			t.Errorf("%s: got %v, want 409", tc.name, err)
		}
	}
	if err := bakeryOrderLedgerRefusal(&BakeryOrder{OrderStatus: "new"}, bakeryOrderLedgerHistory{}); err != nil {
		t.Errorf("an order with no ledger history was refused: %v", err)
	}
}

func TestACancelledOrderWithACOGSJournalIsNotDeleted(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	today := time.Now().UTC().Format("2006-01-02")
	orderID, journalID := testdb.NewUUID(), testdb.NewUUID()
	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	// A zero-total order, completed (stock relieved, COGS posted) and then
	// cancelled: no payments, no revenue journal.
	exec(`INSERT INTO bakery_orders (id, business_id, branch_id, order_number, order_type, order_date, event_date, order_status, created_by_user_id)
		VALUES (?, ?, ?, 'ORD-QA-0097', 'pickup', ?, ?, 'cancelled', ?)`,
		orderID, seeded.BusinessID, seeded.BranchID, today, today, seeded.UserID)
	exec(`INSERT INTO journal_entries (id, business_id, branch_id, entry_number, entry_date, source_type, source_id, status, total_debit, total_credit, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, 'bakery_order_cogs', ?, 'reversed', 12, 12, ?)`,
		journalID, seeded.BusinessID, seeded.BranchID, "JE-"+journalID[:8], today, orderID, seeded.UserID)
	exec(`UPDATE bakery_orders SET cogs_journal_entry_id = ? WHERE id = ?`, journalID, orderID)

	service := NewService(db, NewRepository(db), audit.NewRepository(db), nil, nil)
	err := service.DeleteOrder(seeded.AuthContext(), orderID, "127.0.0.1", "test")
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("deleting an order with a COGS journal returned %v, want 409", err)
	}

	// The journal alone, without the id on the order, is found too.
	exec(`UPDATE bakery_orders SET cogs_journal_entry_id = NULL WHERE id = ?`, orderID)
	if err := service.DeleteOrder(seeded.AuthContext(), orderID, "127.0.0.1", "test"); !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("deleting an order with a journal keyed to it returned %v, want 409", err)
	}

	var deleted bool
	if err := db.Raw(`SELECT deleted_at IS NOT NULL FROM bakery_orders WHERE id = ?`, orderID).Scan(&deleted).Error; err != nil {
		t.Fatalf("read order: %v", err)
	}
	if deleted {
		t.Fatal("the order was deleted although its COGS journal still points at it")
	}
}
