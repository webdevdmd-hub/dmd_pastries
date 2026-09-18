package manufacturing

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-090 — deleting a production batch left the bakery order
// linked to it and stuck "in production".
//
// DeleteBatch soft-deleted the batch and nothing else. The order's production
// rows kept pointing at it, the order detail and the production schedule
// still joined it (without checking deleted_at), and an order that moved from
// confirmed to in_production when this batch was created for it stayed there
// with no production behind it. The backend also deleted in-progress and
// cancelled batches, although the screens only offer "Delete planned".
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestDeletingAPlannedBatchReleasesItsBakeryOrder(t *testing.T) {
	fixture := newBatchOrderFixture(t)
	batchID := fixture.batch(t, "PB-QA-0001", "planned")
	otherBatchID := fixture.batch(t, "PB-QA-0002", "planned")

	// Order A is in production only because of this batch.
	orderA := fixture.order(t, "ORD-QA-0001", "in_production")
	fixture.link(t, orderA, fixture.item(t, orderA), batchID, "assigned")
	// Order B still has another batch once this one is gone.
	orderB := fixture.order(t, "ORD-QA-0002", "in_production")
	fixture.link(t, orderB, fixture.item(t, orderB), batchID, "assigned")
	fixture.link(t, orderB, "", otherBatchID, "assigned")
	// Order C was put in production by hand (production status in progress).
	orderC := fixture.order(t, "ORD-QA-0003", "in_production")
	fixture.link(t, orderC, "", batchID, "in_progress")

	if err := fixture.service.DeleteBatch(fixture.user, batchID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("DeleteBatch: %v", err)
	}

	for order, want := range map[string]string{orderA: "confirmed", orderB: "in_production", orderC: "in_production"} {
		if got := fixture.orderStatus(t, order); got != want {
			t.Errorf("order %s is %q after the batch was deleted, want %q", order, got, want)
		}
	}
	var stillLinked int64
	if err := fixture.db.Raw(`SELECT COUNT(*) FROM bakery_order_productions WHERE production_batch_id = ?`, batchID).
		Scan(&stillLinked).Error; err != nil {
		t.Fatalf("count links: %v", err)
	}
	if stillLinked != 0 {
		t.Errorf("%d production rows still point at the deleted batch", stillLinked)
	}
	var reverted int64
	if err := fixture.db.Raw(`SELECT COUNT(*) FROM audit_logs WHERE entity_id = ? AND event_type = 'bakery_order.status_updated'`, orderA).
		Scan(&reverted).Error; err != nil {
		t.Fatalf("count audit entries: %v", err)
	}
	if reverted != 1 {
		t.Errorf("order A's move back to confirmed wrote %d audit entries, want 1", reverted)
	}
}

func TestOnlyAPlannedBatchCanBeDeleted(t *testing.T) {
	fixture := newBatchOrderFixture(t)

	for _, status := range []string{"in_progress", "cancelled", "completed"} {
		batchID := fixture.batch(t, "PB-QA-"+status, status)
		err := fixture.service.DeleteBatch(fixture.user, batchID, "127.0.0.1", "test")
		var appErr *apperrors.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
			t.Errorf("deleting a %s batch returned %v, want 409", status, err)
		}
	}
	for _, status := range []string{"draft", "planned"} {
		if err := fixture.service.DeleteBatch(fixture.user, fixture.batch(t, "PB-QA-"+status, status), "127.0.0.1", "test"); err != nil {
			t.Errorf("deleting a %s batch: %v", status, err)
		}
	}
}

type batchOrderFixture struct {
	db        *gorm.DB
	seeded    testdb.Seeded
	service   *Service
	user      *utils.AuthContext
	recipeID  string
	productID string
	unitID    string
}

// newBatchOrderFixture seeds one product with one recipe, which is all a
// production batch's foreign keys need. Everything runs in a rolled-back
// transaction.
func newBatchOrderFixture(t *testing.T) *batchOrderFixture {
	t.Helper()
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	fixture := &batchOrderFixture{
		db:        db,
		seeded:    seeded,
		service:   NewService(db, NewRepository(db), nil, nil, audit.NewRepository(db)),
		user:      seeded.AuthContext(),
		recipeID:  testdb.NewUUID(),
		productID: testdb.NewUUID(),
	}
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT 1`).
		Scan(&fixture.unitID).Error; err != nil || fixture.unitID == "" {
		t.Fatalf("no system unit to seed with (err %v)", err)
	}
	categoryID := testdb.NewUUID()
	fixture.exec(t, `INSERT INTO product_categories (id, business_id, branch_id, category_name, category_code) VALUES (?, ?, ?, 'Cakes', ?)`,
		categoryID, seeded.BusinessID, seeded.BranchID, "CAT-"+categoryID[:8])
	fixture.exec(t, `INSERT INTO products (id, business_id, branch_id, category_id, unit_id, product_name, product_code, product_type, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, 'Chocolate cake', ?, 'finished_product', ?, ?)`,
		fixture.productID, seeded.BusinessID, seeded.BranchID, categoryID, fixture.unitID, "PRD-"+fixture.productID[:8], seeded.UserID, seeded.UserID)
	fixture.exec(t, `INSERT INTO recipes (id, business_id, branch_id, product_id, recipe_code, recipe_name, batch_yield_quantity, batch_yield_unit_id, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, 'Chocolate cake', 1, ?, ?)`,
		fixture.recipeID, seeded.BusinessID, seeded.BranchID, fixture.productID, "RCP-"+fixture.recipeID[:8], fixture.unitID, seeded.UserID)
	return fixture
}

func (f *batchOrderFixture) exec(t *testing.T, query string, args ...interface{}) {
	t.Helper()
	if err := f.db.Exec(query, args...).Error; err != nil {
		t.Fatalf("seed: %v", err)
	}
}

func (f *batchOrderFixture) batch(t *testing.T, number, status string) string {
	t.Helper()
	id := testdb.NewUUID()
	f.exec(t, `INSERT INTO production_batches
		(id, business_id, branch_id, recipe_id, product_id, production_batch_number, planned_quantity, yield_unit_id, status, production_date, created_by_user_id, updated_by_user_id)
		VALUES (?, ?, ?, ?, ?, ?, 4, ?, ?, ?, ?, ?)`,
		id, f.seeded.BusinessID, f.seeded.BranchID, f.recipeID, f.productID, number, f.unitID, status,
		time.Now().UTC().Format("2006-01-02"), f.seeded.UserID, f.seeded.UserID)
	return id
}

func (f *batchOrderFixture) order(t *testing.T, number, status string) string {
	t.Helper()
	id := testdb.NewUUID()
	today := time.Now().UTC().Format("2006-01-02")
	f.exec(t, `INSERT INTO bakery_orders (id, business_id, branch_id, order_number, order_type, order_date, event_date, order_status, created_by_user_id)
		VALUES (?, ?, ?, ?, 'pickup', ?, ?, ?, ?)`,
		id, f.seeded.BusinessID, f.seeded.BranchID, number, today, today, status, f.seeded.UserID)
	return id
}

func (f *batchOrderFixture) item(t *testing.T, orderID string) string {
	t.Helper()
	id := testdb.NewUUID()
	f.exec(t, `INSERT INTO bakery_order_items (id, business_id, bakery_order_id, product_name_snapshot, item_name_snapshot, item_source, quantity, unit_id)
		VALUES (?, ?, ?, 'Birthday cake', 'Birthday cake', 'custom', 1, ?)`,
		id, f.seeded.BusinessID, orderID, f.unitID)
	return id
}

// link records a production row; itemID "" is the order-level row.
func (f *batchOrderFixture) link(t *testing.T, orderID, itemID, batchID, status string) {
	t.Helper()
	var item interface{}
	if itemID != "" {
		item = itemID
	}
	f.exec(t, `INSERT INTO bakery_order_productions (id, business_id, bakery_order_id, bakery_order_item_id, production_batch_id, status)
		VALUES (?, ?, ?, ?, ?, ?)`,
		testdb.NewUUID(), f.seeded.BusinessID, orderID, item, batchID, status)
}

func (f *batchOrderFixture) orderStatus(t *testing.T, orderID string) string {
	t.Helper()
	var status string
	if err := f.db.Raw(`SELECT order_status FROM bakery_orders WHERE id = ?`, orderID).Scan(&status).Error; err != nil {
		t.Fatalf("read order status: %v", err)
	}
	return status
}
