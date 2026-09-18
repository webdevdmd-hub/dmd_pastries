package suppliers

import (
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-088 — after a supplier was deleted, its ingredients and
// packaging items could not be saved.
//
// Deleting a supplier soft-deleted it but left ingredients.supplier_id and
// packaging_items.supplier_id pointing at it. Their edit forms resubmit that
// id, and the ingredient and packaging repositories reject a deleted supplier
// with 404 "supplier not found", so every such item was stuck until someone
// guessed to clear the supplier field. The delete now clears those links in
// the same transaction. Purchasing documents are untouched: a supplier with
// any is refused before this point.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
func TestDeletingASupplierClearsItAsTheItemsSupplier(t *testing.T) {
	db := testdb.Connect(t)
	seeded := testdb.Seed(t, db)
	t.Cleanup(func() {
		for _, statement := range []string{
			`DELETE FROM ingredients WHERE business_id = ?`,
			`DELETE FROM packaging_items WHERE business_id = ?`,
			`DELETE FROM ingredient_categories WHERE business_id = ?`,
			`DELETE FROM packaging_categories WHERE business_id = ?`,
			`DELETE FROM audit_logs WHERE business_id = ?`,
		} {
			_ = db.Exec(statement, seeded.BusinessID).Error
		}
	})

	deleted := seeded.SeedSupplier(t, db, "QA Closed Mill")
	kept := seeded.SeedSupplier(t, db, "QA Open Mill")
	unitID := anyUnit(t, db)
	ingredientCategory, packagingCategory := testdb.NewUUID(), testdb.NewUUID()
	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO ingredient_categories (id, business_id, branch_id, category_name) VALUES (?, ?, ?, 'Flours')`,
		ingredientCategory, seeded.BusinessID, seeded.BranchID)
	exec(`INSERT INTO packaging_categories (id, business_id, branch_id, category_name) VALUES (?, ?, ?, 'Boxes')`,
		packagingCategory, seeded.BusinessID, seeded.BranchID)
	flour, rye := testdb.NewUUID(), testdb.NewUUID()
	for _, row := range []struct{ id, supplier, code string }{{flour, deleted, "ING-QA-1"}, {rye, kept, "ING-QA-2"}} {
		exec(`INSERT INTO ingredients (id, business_id, branch_id, ingredient_category_id, supplier_id, ingredient_name, ingredient_code, unit_id, created_by_user_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			row.id, seeded.BusinessID, seeded.BranchID, ingredientCategory, row.supplier, "Flour "+row.code, row.code, unitID, seeded.UserID)
	}
	box := testdb.NewUUID()
	exec(`INSERT INTO packaging_items (id, business_id, branch_id, packaging_category_id, supplier_id, packaging_name, packaging_code, unit_id, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, 'Cake box', 'PKG-QA-1', ?, ?)`,
		box, seeded.BusinessID, seeded.BranchID, packagingCategory, deleted, unitID, seeded.UserID)

	service := NewService(db, NewRepository(db), audit.NewRepository(db))
	if err := service.DeleteSupplier(seeded.AuthContext(), deleted, "127.0.0.1", "test"); err != nil {
		t.Fatalf("DeleteSupplier: %v", err)
	}

	if got := supplierOf(t, db, "ingredients", flour); got != "" {
		t.Errorf("the ingredient still names the deleted supplier %s; saving it fails with 404", got)
	}
	if got := supplierOf(t, db, "packaging_items", box); got != "" {
		t.Errorf("the packaging item still names the deleted supplier %s; saving it fails with 404", got)
	}
	if got := supplierOf(t, db, "ingredients", rye); got != kept {
		t.Errorf("an ingredient of another supplier lost its supplier (now %q)", got)
	}
}

func anyUnit(t *testing.T, db *gorm.DB) string {
	t.Helper()
	var id string
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT 1`).Scan(&id).Error; err != nil || id == "" {
		t.Fatalf("no system unit to seed with (err %v)", err)
	}
	return id
}

func supplierOf(t *testing.T, db *gorm.DB, table, id string) string {
	t.Helper()
	var supplierID *string
	if err := db.Raw(`SELECT supplier_id FROM `+table+` WHERE id = ?`, id).Scan(&supplierID).Error; err != nil {
		t.Fatalf("read %s: %v", table, err)
	}
	if supplierID == nil {
		return ""
	}
	return *supplierID
}
