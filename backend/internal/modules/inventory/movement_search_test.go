package inventory

import (
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/testsupport/testdb"
)

// The Stock Movements search box had never worked: every keystroke returned a
// 500. The search branch of applyMovementFilters joins five tables that all
// carry business_id and created_at, while ListMovements scoped and sorted on
// those columns unqualified, so Postgres refused the statement as ambiguous
// before it looked at a single row.
//
// These tests run the repository against a real database because that is the
// only place the ambiguity exists -- the Go code compiles either way.

// seededMovement is the chain of rows a single stock movement's foreign keys
// demand, plus the ingredient name the search predicate reads.
type seededMovement struct {
	InventoryItemID string
	MovementID      string
	IngredientName  string
}

func seedMovement(t *testing.T, db *gorm.DB, seed testdb.Seeded, ingredientName, referenceNumber string) seededMovement {
	t.Helper()

	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed movement: %v", err)
		}
	}

	// Units are seeded globally by migration 000006 and shared by every
	// business, so a test does not need to mint its own.
	var unitID string
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL LIMIT 1`).Scan(&unitID).Error; err != nil {
		t.Fatalf("look up a system unit: %v", err)
	}
	if unitID == "" {
		t.Fatal("no system default unit: migration 000006 did not seed units")
	}

	categoryID := testdb.NewUUID()
	ingredientID := testdb.NewUUID()
	result := seededMovement{
		InventoryItemID: testdb.NewUUID(),
		MovementID:      testdb.NewUUID(),
		IngredientName:  ingredientName,
	}

	exec(`INSERT INTO ingredient_categories (id, business_id, branch_id, category_name) VALUES (?, ?, ?, ?)`,
		categoryID, seed.BusinessID, seed.BranchID, "Category "+categoryID[:8])
	exec(`INSERT INTO ingredients
		(id, business_id, branch_id, ingredient_category_id, ingredient_name, ingredient_code, unit_id, created_by_user_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		ingredientID, seed.BusinessID, seed.BranchID, categoryID, ingredientName, "ING-"+ingredientID[:8], unitID, seed.UserID)
	exec(`INSERT INTO inventory_items
		(id, business_id, branch_id, ingredient_id, item_type, current_quantity, available_quantity, unit_id)
		VALUES (?, ?, ?, ?, 'ingredient', 10, 10, ?)`,
		result.InventoryItemID, seed.BusinessID, seed.BranchID, ingredientID, unitID)
	exec(`INSERT INTO stock_movements
		(id, business_id, branch_id, inventory_item_id, item_type, movement_type, movement_direction,
		 quantity, before_quantity, after_quantity, unit_id, reference_number, created_by_user_id)
		VALUES (?, ?, ?, ?, 'ingredient', 'purchase_in', 'in', 10, 0, 10, ?, ?, ?)`,
		result.MovementID, seed.BusinessID, seed.BranchID, result.InventoryItemID, unitID, referenceNumber, seed.UserID)

	return result
}

// Typing in the search box is the reported failure: the request 500s.
func TestMovementSearchRunsAtAll(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	seedMovement(t, db, seed, "Croissant Dough", "GRN-0001")

	repository := NewRepository(db)
	_, _, err := repository.ListMovements(seed.BusinessID, "", MovementListQuery{
		Search: "Croissant",
		Page:   1,
		Limit:  20,
	})
	if err != nil {
		t.Fatalf("search movements: %v", err)
	}
}

// The search must find the movement by the item's name and by the movement's
// own reference number, and must leave the others behind.
func TestMovementSearchMatchesItemNameAndReference(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	wanted := seedMovement(t, db, seed, "Croissant Dough", "GRN-0001")
	seedMovement(t, db, seed, "Sourdough Starter", "GRN-0002")

	repository := NewRepository(db)

	for _, search := range []string{"croissant", "GRN-0001"} {
		movements, total, err := repository.ListMovements(seed.BusinessID, "", MovementListQuery{
			Search: search,
			Page:   1,
			Limit:  20,
		})
		if err != nil {
			t.Fatalf("search %q: %v", search, err)
		}
		if total != 1 {
			t.Fatalf("search %q matched %d movements, want 1", search, total)
		}
		if len(movements) != 1 || movements[0].ID != wanted.MovementID {
			t.Fatalf("search %q returned %v, want the movement for %s", search, movements, wanted.IngredientName)
		}
	}
}

// The summary strip sits above the same list and takes the same filters, so it
// carried the same defect on the same query string.
func TestMovementSummaryRunsWithASearch(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	seedMovement(t, db, seed, "Croissant Dough", "GRN-0001")
	seedMovement(t, db, seed, "Sourdough Starter", "GRN-0002")

	repository := NewRepository(db)
	summary, err := repository.MovementSummary(seed.BusinessID, MovementListQuery{Search: "Croissant"})
	if err != nil {
		t.Fatalf("summarise movements: %v", err)
	}
	if summary.MovementCount != 1 {
		t.Fatalf("summary counted %d movements, want 1", summary.MovementCount)
	}
}

// seedProductMovement is the product-backed counterpart of seedMovement. The
// product type filter reads products.product_type through
// inventory_items.product_id, so an ingredient-backed row cannot exercise it.
func seedProductMovement(t *testing.T, db *gorm.DB, seed testdb.Seeded, productName, productType string) string {
	t.Helper()

	exec := func(query string, args ...interface{}) {
		t.Helper()
		if err := db.Exec(query, args...).Error; err != nil {
			t.Fatalf("seed product movement: %v", err)
		}
	}

	var unitID string
	if err := db.Raw(`SELECT id FROM units WHERE business_id IS NULL AND deleted_at IS NULL LIMIT 1`).Scan(&unitID).Error; err != nil {
		t.Fatalf("look up a system unit: %v", err)
	}

	categoryID := testdb.NewUUID()
	productID := testdb.NewUUID()
	inventoryItemID := testdb.NewUUID()
	movementID := testdb.NewUUID()

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
	exec(`INSERT INTO stock_movements
		(id, business_id, branch_id, inventory_item_id, item_type, movement_type, movement_direction,
		 quantity, before_quantity, after_quantity, unit_id, created_by_user_id)
		VALUES (?, ?, ?, ?, 'product', 'purchase_in', 'in', 10, 0, 10, ?, ?)`,
		movementID, seed.BusinessID, seed.BranchID, inventoryItemID, unitID, seed.UserID)

	return movementID
}

// The product type filter did nothing at all: MovementListQuery had no such
// field, the handler never bound product_type, and applyMovementFilters never
// read it, so choosing a type returned the whole ledger. A test that only
// asserted "the chosen type comes back" would have passed against that bug --
// it has to prove the other types are excluded.
func TestMovementProductTypeFilterExcludesOtherTypes(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	wanted := seedProductMovement(t, db, seed, "Butter Croissant", "finished_product")
	seedProductMovement(t, db, seed, "Mixer", "equipment")

	repository := NewRepository(db)

	movements, total, err := repository.ListMovements(seed.BusinessID, "", MovementListQuery{
		ProductType: "finished_product",
		Page:        1,
		Limit:       20,
	})
	if err != nil {
		t.Fatalf("filter by product type: %v", err)
	}
	if total != 1 || len(movements) != 1 {
		t.Fatalf("product_type=finished_product returned %d movements (total %d), want 1", len(movements), total)
	}
	if movements[0].ID != wanted {
		t.Fatal("product_type=finished_product returned the wrong movement")
	}

	// A type nothing was seeded under must come back empty rather than whole.
	_, emptyTotal, err := repository.ListMovements(seed.BusinessID, "", MovementListQuery{
		ProductType: "service",
		Page:        1,
		Limit:       20,
	})
	if err != nil {
		t.Fatalf("filter by an unused product type: %v", err)
	}
	if emptyTotal != 0 {
		t.Fatalf("product_type=service returned %d movements, want 0", emptyTotal)
	}
}

// Search joins products p while the product type filter reaches products
// through an EXISTS aliased mi/mp. Combining them is what would expose an
// alias collision, and Count and Find share the builder -- a join instead of
// EXISTS would multiply rows and inflate the total.
func TestMovementSearchAndProductTypeCombine(t *testing.T) {
	db := testdb.Tx(t)
	seed := testdb.Seed(t, db)
	wanted := seedProductMovement(t, db, seed, "Butter Croissant", "finished_product")
	seedProductMovement(t, db, seed, "Croissant Mixer", "equipment")

	repository := NewRepository(db)
	movements, total, err := repository.ListMovements(seed.BusinessID, "", MovementListQuery{
		Search:      "Croissant",
		ProductType: "finished_product",
		Page:        1,
		Limit:       20,
	})
	if err != nil {
		t.Fatalf("search combined with product type: %v", err)
	}
	if total != 1 || len(movements) != 1 {
		t.Fatalf("search+product_type returned %d movements (total %d), want 1", len(movements), total)
	}
	if movements[0].ID != wanted {
		t.Fatal("search+product_type returned the wrong movement")
	}
}

// Search widens a tenant-scoped list; it must not widen it past the tenant.
func TestMovementSearchStaysWithinTheBusiness(t *testing.T) {
	db := testdb.Tx(t)
	mine := testdb.Seed(t, db)
	theirs := testdb.Seed(t, db)
	seedMovement(t, db, mine, "Croissant Dough", "GRN-0001")
	seedMovement(t, db, theirs, "Croissant Dough", "GRN-0001")

	repository := NewRepository(db)
	movements, total, err := repository.ListMovements(mine.BusinessID, "", MovementListQuery{
		Search: "Croissant",
		Page:   1,
		Limit:  20,
	})
	if err != nil {
		t.Fatalf("search movements: %v", err)
	}
	if total != 1 || len(movements) != 1 {
		t.Fatalf("search returned %d movements (total %d), want 1 from this business only", len(movements), total)
	}
	if movements[0].BusinessID != mine.BusinessID {
		t.Fatalf("search returned a movement from business %s, want %s", movements[0].BusinessID, mine.BusinessID)
	}
}
