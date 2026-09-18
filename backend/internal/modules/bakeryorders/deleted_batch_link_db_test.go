package bakeryorders

import (
	"testing"
	"time"

	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-090 — a deleted production batch still showed on the
// bakery order it was made for.
//
// The order's production rows were read with a join to production_batches
// that ignored deleted_at, so a batch deleted before the unlink fix kept
// appearing, number and all, and its id offered a link to a batch that 404s.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
func TestAnOrderDoesNotShowADeletedBatch(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	var unitID string
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT 1`).
		Scan(&unitID).Error; err != nil || unitID == "" {
		t.Fatalf("no system unit to seed with (err %v)", err)
	}
	categoryID, productID, recipeID, batchID, orderID := testdb.NewUUID(), testdb.NewUUID(), testdb.NewUUID(), testdb.NewUUID(), testdb.NewUUID()
	today := time.Now().UTC().Format("2006-01-02")
	exec(`INSERT INTO product_categories (id, business_id, branch_id, category_name, category_code) VALUES (?, ?, ?, 'Cakes', ?)`,
		categoryID, seeded.BusinessID, seeded.BranchID, "CAT-"+categoryID[:8])
	exec(`INSERT INTO products (id, business_id, branch_id, category_id, unit_id, product_name, product_code, product_type, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, 'Chocolate cake', ?, 'finished_product', ?, ?)`,
		productID, seeded.BusinessID, seeded.BranchID, categoryID, unitID, "PRD-"+productID[:8], seeded.UserID, seeded.UserID)
	exec(`INSERT INTO recipes (id, business_id, branch_id, product_id, recipe_code, recipe_name, batch_yield_quantity, batch_yield_unit_id, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, 'Chocolate cake', 1, ?, ?)`,
		recipeID, seeded.BusinessID, seeded.BranchID, productID, "RCP-"+recipeID[:8], unitID, seeded.UserID)
	exec(`INSERT INTO production_batches
		(id, business_id, branch_id, recipe_id, product_id, production_batch_number, planned_quantity, yield_unit_id, status, production_date, created_by_user_id, updated_by_user_id, deleted_at)
		VALUES (?, ?, ?, ?, ?, 'PB-QA-GONE', 2, ?, 'planned', ?, ?, ?, now())`,
		batchID, seeded.BusinessID, seeded.BranchID, recipeID, productID, unitID, today, seeded.UserID, seeded.UserID)
	exec(`INSERT INTO bakery_orders (id, business_id, branch_id, order_number, order_type, order_date, event_date, order_status, created_by_user_id)
		VALUES (?, ?, ?, 'ORD-QA-0090', 'pickup', ?, ?, 'confirmed', ?)`,
		orderID, seeded.BusinessID, seeded.BranchID, today, today, seeded.UserID)
	exec(`INSERT INTO bakery_order_productions (id, business_id, bakery_order_id, production_batch_id, status) VALUES (?, ?, ?, ?, 'assigned')`,
		testdb.NewUUID(), seeded.BusinessID, orderID, batchID)

	repo := NewRepository(db)
	rows, err := repo.Productions(seeded.BusinessID, orderID)
	if err != nil {
		t.Fatalf("Productions: %v", err)
	}
	production, err := repo.Production(seeded.BusinessID, orderID)
	if err != nil {
		t.Fatalf("Production: %v", err)
	}
	if len(rows) != 1 || production == nil {
		t.Fatalf("want the order's one production row, got %d rows and %v", len(rows), production)
	}
	for _, row := range []BakeryOrderProductionResponse{rows[0], *production} {
		if row.ProductionBatchID != nil || row.ProductionBatchNumber != "" {
			t.Errorf("the order still shows deleted batch %q (linked id set: %t)", row.ProductionBatchNumber, row.ProductionBatchID != nil)
		}
	}
}
