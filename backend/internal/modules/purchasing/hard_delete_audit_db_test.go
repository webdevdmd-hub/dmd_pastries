package purchasing

import (
	"encoding/json"
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-082 — the activity log could not say what a deleted
// supplier payment, purchase order or draft bill had been.
//
// These three are hard-deleted, and audit() looked the record up to describe
// it only after the delete had run. The row was gone, so the entry had no
// reference or document number, and it never carried the amount or the
// supplier at all. The fix describes the document while it still exists.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestDeletingAPurchaseOrderKeepsItsNumberInTheAuditLog(t *testing.T) {
	db, seeded, service, user := hardDeleteAuditFixture(t)
	supplierID := seeded.SeedSupplier(t, db, "QA Dairy Co")
	orderID := seedDraftPurchaseOrder(t, db, seeded, supplierID, "PO-900042")

	if err := service.DeleteOrder(user, orderID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("DeleteOrder: %v", err)
	}

	metadata := deleteAuditMetadata(t, db, "purchase_order.hard_deleted", orderID)
	expectMetadata(t, metadata, map[string]interface{}{
		"purchase_order_number": "PO-900042",
		"record_label":          "PO-900042",
		"supplier_name":         "QA Dairy Co",
		"supplier_id":           supplierID,
		"amount":                float64(125),
	})
}

func TestDeletingADraftBillKeepsItsNumberInTheAuditLog(t *testing.T) {
	db, seeded, service, user := hardDeleteAuditFixture(t)
	supplierID := seeded.SeedSupplier(t, db, "QA Packaging Ltd")
	invoiceID := testdb.NewUUID()
	if err := db.Exec(`INSERT INTO purchase_invoices
		(id, business_id, branch_id, supplier_id, invoice_number, invoice_date, status, total_amount, balance_amount, created_by_user_id, updated_by_user_id)
		VALUES (?, ?, ?, ?, 'PI-900007', ?, 'draft', 80.5, 80.5, ?, ?)`,
		invoiceID, seeded.BusinessID, seeded.BranchID, supplierID, time.Now().UTC().Format("2006-01-02"),
		seeded.UserID, seeded.UserID).Error; err != nil {
		t.Fatalf("seed draft bill: %v", err)
	}

	if err := service.DeleteInvoice(user, invoiceID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("DeleteInvoice: %v", err)
	}

	metadata := deleteAuditMetadata(t, db, "purchase_invoice.hard_deleted", invoiceID)
	expectMetadata(t, metadata, map[string]interface{}{
		"invoice_number": "PI-900007",
		"record_label":   "PI-900007",
		"supplier_name":  "QA Packaging Ltd",
		"amount":         80.5,
	})
}

func TestDeletingASupplierPaymentKeepsItsReferenceAmountAndSupplier(t *testing.T) {
	db, seeded, service, user := hardDeleteAuditFixture(t)
	supplierID := seeded.SeedSupplier(t, db, "QA Sugar Traders")
	methodID, accountID := testdb.NewUUID(), testdb.NewUUID()
	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO payment_methods (id, business_id, method_name, method_type) VALUES (?, ?, 'Bank transfer', 'bank_transfer')`,
		methodID, seeded.BusinessID)
	exec(`INSERT INTO payment_accounts (id, business_id, branch_id, account_name, account_type, chart_account_id) VALUES (?, ?, ?, 'Main bank', 'bank', ?)`,
		accountID, seeded.BusinessID, seeded.BranchID, seeded.AccountID(t, db, "1000"))
	paymentID := testdb.NewUUID()
	exec(`INSERT INTO supplier_payments
		(id, business_id, branch_id, supplier_id, payment_method_id, payment_method_name_snapshot, payment_method_type_snapshot,
		 paid_through_account_id, amount, allocated_amount, unapplied_amount, reference_number, payment_date, status, paid_by_user_id)
		VALUES (?, ?, ?, ?, ?, 'Bank transfer', 'bank_transfer', ?, 300, 0, 300, 'TRF-5531', now(), 'completed', ?)`,
		paymentID, seeded.BusinessID, seeded.BranchID, supplierID, methodID, accountID, seeded.UserID)

	if err := service.DeleteSupplierPayment(user, paymentID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("DeleteSupplierPayment: %v", err)
	}

	metadata := deleteAuditMetadata(t, db, "supplier_payment.deleted", paymentID)
	expectMetadata(t, metadata, map[string]interface{}{
		"reference_number": "TRF-5531",
		"record_label":     "TRF-5531",
		"supplier_name":    "QA Sugar Traders",
		"amount":           float64(300),
	})
}

func hardDeleteAuditFixture(t *testing.T) (*gorm.DB, testdb.Seeded, *Service, *utils.AuthContext) {
	t.Helper()
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	service := NewService(db, NewRepository(db), nil, nil, audit.NewRepository(db))
	user := seeded.AuthContext()
	user.Permissions = []string{"purchasing.manage"}
	return db, seeded, service, user
}

func deleteAuditMetadata(t *testing.T, db *gorm.DB, eventType, entityID string) map[string]interface{} {
	t.Helper()
	var raw string
	if err := db.Raw(`SELECT COALESCE(metadata::text, '') FROM audit_logs WHERE event_type = ? AND entity_id = ?`, eventType, entityID).
		Scan(&raw).Error; err != nil {
		t.Fatalf("read %s audit entry: %v", eventType, err)
	}
	if raw == "" {
		t.Fatalf("no %s audit entry for %s", eventType, entityID)
	}
	metadata := map[string]interface{}{}
	if err := json.Unmarshal([]byte(raw), &metadata); err != nil {
		t.Fatalf("decode audit metadata %s: %v", raw, err)
	}
	return metadata
}

func expectMetadata(t *testing.T, metadata map[string]interface{}, want map[string]interface{}) {
	t.Helper()
	for key, value := range want {
		if metadata[key] != value {
			t.Errorf("audit metadata %s = %#v, want %#v (metadata: %v)", key, metadata[key], value, metadata)
		}
	}
}
