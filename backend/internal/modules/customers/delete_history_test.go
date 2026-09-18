package customers

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-087 — a customer with orders could be deleted, and then
// their orders could not be edited.
//
// DeleteCustomer soft-deleted any customer. Their bakery orders still pointed
// at them, so saving one afterwards failed with 404 "customer not found"
// (bakeryorders.validCustomer), an expense naming them failed the same way,
// and their store credit could no longer be picked at the till. A customer
// with history is now refused with 409 and told to deactivate instead.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestTheRefusalNamesWhatTheCustomerHas(t *testing.T) {
	if err := customerDeleteRefusal(customerHistory{}); err != nil {
		t.Fatalf("a customer with no history was refused: %v", err)
	}

	err := customerDeleteRefusal(customerHistory{BakeryOrders: 2, Sales: 1, StoreCredit: 1})
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("a customer with orders returned %v, want 409", err)
	}
	for _, want := range []string{"2 bakery orders", "1 sale", "store credit", "Deactivate the customer instead"} {
		if !strings.Contains(appErr.Message, want) {
			t.Errorf("refusal %q does not mention %q", appErr.Message, want)
		}
	}

	for name, history := range map[string]customerHistory{
		"an expense":         {Expenses: 1},
		"an opening balance": {OpeningBalances: 1},
	} {
		if customerDeleteRefusal(history) == nil {
			t.Errorf("a customer with %s was not refused", name)
		}
	}
}

func TestACustomerWithABakeryOrderIsNotDeleted(t *testing.T) {
	db := testdb.Connect(t)
	seeded := testdb.Seed(t, db)
	t.Cleanup(func() {
		_ = db.Exec(`DELETE FROM bakery_orders WHERE business_id = ?`, seeded.BusinessID).Error
		_ = db.Exec(`DELETE FROM customer_credits WHERE business_id = ?`, seeded.BusinessID).Error
		_ = db.Exec(`DELETE FROM audit_logs WHERE business_id = ?`, seeded.BusinessID).Error
	})
	service := NewService(db, NewRepository(db), audit.NewRepository(db))
	user := seeded.AuthContext()

	withOrder := seeded.SeedCustomer(t, db, "Rania Haddad")
	if err := db.Exec(`INSERT INTO bakery_orders
		(id, business_id, branch_id, order_number, customer_id, order_type, order_date, event_date, order_status, created_by_user_id)
		VALUES (?, ?, ?, 'ORD-900001', ?, 'pickup', ?, ?, 'confirmed', ?)`,
		testdb.NewUUID(), seeded.BusinessID, seeded.BranchID, withOrder,
		time.Now().UTC().Format("2006-01-02"), time.Now().UTC().Format("2006-01-02"), seeded.UserID).Error; err != nil {
		t.Fatalf("seed bakery order: %v", err)
	}
	err := service.DeleteCustomer(user, withOrder, "127.0.0.1", "test")
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("deleting a customer with a bakery order returned %v, want 409", err)
	}
	if deleted := customerDeletedAt(t, db, withOrder); deleted {
		t.Fatal("the refused delete still removed the customer")
	}

	withCredit := seeded.SeedCustomer(t, db, "Omar Nasser")
	if err := db.Exec(`INSERT INTO customer_credits
		(id, business_id, branch_id, customer_id, source_type, amount, balance, created_by_user_id)
		VALUES (?, ?, ?, ?, 'manual', 40, 15, ?)`,
		testdb.NewUUID(), seeded.BusinessID, seeded.BranchID, withCredit, seeded.UserID).Error; err != nil {
		t.Fatalf("seed store credit: %v", err)
	}
	if err := service.DeleteCustomer(user, withCredit, "127.0.0.1", "test"); !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("deleting a customer holding store credit returned %v, want 409", err)
	}

	noHistory := seeded.SeedCustomer(t, db, "Walk-in duplicate")
	if err := service.DeleteCustomer(user, noHistory, "127.0.0.1", "test"); err != nil {
		t.Fatalf("deleting a customer with no history: %v", err)
	}
	if deleted := customerDeletedAt(t, db, noHistory); !deleted {
		t.Fatal("a customer with no history was not deleted")
	}
}

func customerDeletedAt(t *testing.T, db *gorm.DB, id string) bool {
	t.Helper()
	var deleted bool
	if err := db.Raw(`SELECT deleted_at IS NOT NULL FROM customers WHERE id = ?`, id).Scan(&deleted).Error; err != nil {
		t.Fatalf("read customer: %v", err)
	}
	return deleted
}
