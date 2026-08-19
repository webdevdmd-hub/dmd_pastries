package inventory

import (
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/testsupport/testdb"
)

// The inventory list's product type filter shipped in the same change that
// fixed the movements list's dead filter, and it carries the same two risks
// that filter proved real: a predicate that silently matches everything, and
// an EXISTS-versus-join choice made so the count query cannot inflate when
// the search branch adds its `products p` join. The movements side has
// TestMovementProductTypeFilterExcludesOtherTypes; this is the sibling the
// list path never had. Same real-database harness, same reason: the alias
// collision and the count arithmetic do not exist in compiled Go.

// seedProductInventoryItem plants a product-backed inventory item and returns
// its id. It reuses the seeding idiom from seedProductMovement without the
// movement row, because the list reads inventory_items, not stock_movements.
func seedProductInventoryItem(t *testing.T, db *gorm.DB, seed testdb.Seeded, productName, productType string) string {
	t.Helper()

	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed product inventory item: %v", err)
		}
	}

	var unitID string
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL LIMIT 1`).Scan(&unitID).Error; err != nil {
		t.Fatalf("look up a system unit: %v", err)
	}

	categoryID := testdb.NewUUID()
	productID := testdb.NewUUID()
	inventoryItemID := testdb.NewUUID()

	exec(`INSERT INTO product_categories (id, business_id, branch_id, category_name, category_code) VALUES (?, ?, ?, ?, ?)`,
		categoryID, seed.BusinessID, seed.BranchID, "Cat "+categoryID[:8], "CAT-"+categoryID[:8])
	exec(`INSERT INTO products
		(id, business_id, branch_id, category_id, unit_id, product_name, product_code, product_type, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		productID, seed.BusinessID, seed.BranchID, categoryID, unitID, productName, "PRD-"+productID[:8], productType, seed.UserID, seed.UserID)
	exec(`INSERT INTO inventory_items
		(id, business_id, branch_id, product_id, item_type, current_quantity, available_quantity, unit_id)
		VALUES (?, ?, ?, ?, 'product', 10, 10, ?)`,
		inventoryItemID, seed.BusinessID, seed.BranchID, productID, unitID)

	return inventoryItemID
}

// A filter that matches everything is worse than no filter: the operator
// reads a filtered list that is silently the unfiltered one.
func TestInventoryProductTypeFilterExcludesOtherTypes(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	wanted := seedProductInventoryItem(t, db, seed, "Sourdough Loaf", "finished_product")
	seedProductInventoryItem(t, db, seed, "Stand Mixer", "equipment")

	repository := NewRepository(db)

	items, total, err := repository.ListInventoryItems(seed.BusinessID, InventoryListQuery{
		ProductType: "finished_product",
		Page:        1,
		Limit:       20,
	})
	if err != nil {
		t.Fatalf("list with product type: %v", err)
	}
	if total != 1 {
		t.Fatalf("product type filter matched %d items, want 1", total)
	}
	if len(items) != 1 || items[0].ID != wanted {
		t.Fatalf("product type filter returned %d items, want the finished product", len(items))
	}

	_, total, err = repository.ListInventoryItems(seed.BusinessID, InventoryListQuery{
		ProductType: "raw_material",
		Page:        1,
		Limit:       20,
	})
	if err != nil {
		t.Fatalf("list with unused product type: %v", err)
	}
	if total != 0 {
		t.Fatalf("unused product type matched %d items, want 0", total)
	}
}

// The filter uses EXISTS precisely because the search branch already joins
// `products p` and the same builder feeds Count. Running both together is the
// case that would surface an alias collision or an inflated total.
func TestInventorySearchAndProductTypeCombine(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	wanted := seedProductInventoryItem(t, db, seed, "Sourdough Loaf", "finished_product")
	seedProductInventoryItem(t, db, seed, "Sourdough Mixer", "equipment")

	repository := NewRepository(db)

	items, total, err := repository.ListInventoryItems(seed.BusinessID, InventoryListQuery{
		ProductType: "finished_product",
		Search:      "sourdough",
		Page:        1,
		Limit:       20,
	})
	if err != nil {
		t.Fatalf("search combined with product type: %v", err)
	}
	if total != 1 {
		t.Fatalf("combined filters counted %d items, want 1 (a join would inflate this)", total)
	}
	if len(items) != 1 || items[0].ID != wanted {
		t.Fatalf("combined filters returned %d items, want only the finished product", len(items))
	}
}

// The include-uninitialized path builds its own union SQL rather than going
// through applyInventoryFilters, and it shipped without the ProductType
// predicate -- so flipping "include uninitialized" on silently un-filtered the
// list while the filter chip stayed lit. Both rows here are uninitialized
// products (no inventory_items row), which forces the union's catalog arm.
func TestInventoryProductTypeFilterSurvivesIncludeUninitialized(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)

	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed uninitialized product: %v", err)
		}
	}

	var unitID string
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL LIMIT 1`).Scan(&unitID).Error; err != nil {
		t.Fatalf("look up a system unit: %v", err)
	}

	categoryID := testdb.NewUUID()
	exec(`INSERT INTO product_categories (id, business_id, branch_id, category_name, category_code) VALUES (?, ?, ?, ?, ?)`,
		categoryID, seed.BusinessID, seed.BranchID, "Cat "+categoryID[:8], "CAT-"+categoryID[:8])

	plant := func(name, productType string) {
		productID := testdb.NewUUID()
		exec(`INSERT INTO products
			(id, business_id, branch_id, category_id, unit_id, product_name, product_code, product_type, is_stock_tracked, created_by, updated_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?)`,
			productID, seed.BusinessID, seed.BranchID, categoryID, unitID, name, "PRD-"+productID[:8], productType, seed.UserID, seed.UserID)
	}
	plant("Sourdough Loaf", "finished_product")
	plant("Stand Mixer", "equipment")

	repository := NewRepository(db)

	responses, total, err := repository.ListInventoryWithUninitializedResponses(seed.BusinessID, InventoryListQuery{
		IncludeUninitialized: true,
		ProductType:          "finished_product",
		Page:                 1,
		Limit:                20,
	})
	if err != nil {
		t.Fatalf("list with uninitialized and product type: %v", err)
	}
	if total != 1 {
		t.Fatalf("product type on the uninitialized path matched %d rows, want 1", total)
	}
	if len(responses) != 1 || responses[0].ItemName != "Sourdough Loaf" {
		t.Fatalf("uninitialized path returned %d rows, want only the finished product", len(responses))
	}
}
