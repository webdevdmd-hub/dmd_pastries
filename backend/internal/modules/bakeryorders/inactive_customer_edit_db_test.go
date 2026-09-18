package bakeryorders

import (
	"testing"
	"time"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-087 — the way out of a refused customer delete had to
// work.
//
// A customer with bakery orders can no longer be deleted; the refusal tells
// the user to deactivate them. But the order form resubmits the order's
// customer on every save, and UpdateOrder re-validated it as a new choice, so
// every order of a deactivated customer failed with "customer must be active".
// An order keeps the customer it already has; only a new customer must be
// active.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
func TestAnOrderOfADeactivatedCustomerCanStillBeEdited(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	customerID := seeded.SeedCustomer(t, db, "Rania Haddad")
	if err := db.Exec(`UPDATE customers SET status = 'inactive' WHERE id = ?`, customerID).Error; err != nil {
		t.Fatalf("deactivate customer: %v", err)
	}
	orderID := testdb.NewUUID()
	today := time.Now().UTC().Format("2006-01-02")
	if err := db.Exec(`INSERT INTO bakery_orders
		(id, business_id, branch_id, order_number, customer_id, customer_name_snapshot, order_type, order_date, event_date, order_status, created_by_user_id)
		VALUES (?, ?, ?, 'ORD-900002', ?, 'Rania Haddad', 'pickup', ?, ?, 'confirmed', ?)`,
		orderID, seeded.BusinessID, seeded.BranchID, customerID, today, today, seeded.UserID).Error; err != nil {
		t.Fatalf("seed bakery order: %v", err)
	}

	service := NewService(db, NewRepository(db), audit.NewRepository(db), nil, nil)
	notes := "Pick up after 5pm"
	if _, err := service.UpdateOrder(seeded.AuthContext(), orderID, UpdateOrderRequest{CustomerID: &customerID, Notes: &notes}, "127.0.0.1", "test"); err != nil {
		t.Fatalf("editing the order of a deactivated customer: %v", err)
	}

	// A different inactive customer is still refused.
	otherID := seeded.SeedCustomer(t, db, "Omar Nasser")
	if err := db.Exec(`UPDATE customers SET status = 'inactive' WHERE id = ?`, otherID).Error; err != nil {
		t.Fatalf("deactivate customer: %v", err)
	}
	if _, err := service.UpdateOrder(seeded.AuthContext(), orderID, UpdateOrderRequest{CustomerID: &otherID}, "127.0.0.1", "test"); err == nil {
		t.Fatal("an order was moved to an inactive customer")
	}
}
