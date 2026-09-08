package manufacturing

import (
	"testing"
	"time"

	"pastries-pos/internal/testsupport/testdb"
)

// A one-click production ("Produce now") creates the batch and completes it
// inside a single transaction. completeBatchTx then reads the consumption rows
// back to decide what to consume.
//
// Those reads used to go through the repository's own pooled handle instead of
// the caller's transaction, so they could not see the rows the same
// transaction had just inserted. The read came back empty, and the "no
// consumable lines" guard fired with reason recipe_components_not_consumable --
// telling the user to fix a recipe that was already correct. The planned path
// ("Produce planned") was unaffected only because its rows were committed by an
// earlier request.
//
// This test pins the isolation behaviour that made the two paths differ: rows
// written inside a transaction must be visible to a read on that same
// transaction, and must not be visible to one on the pooled connection.
func TestIngredientsReadsThroughCallerTransaction(t *testing.T) {
	pool := testdb.Connect(t)
	seeded := testdb.Seed(t, pool)

	tx := pool.Begin()
	if tx.Error != nil {
		t.Fatalf("begin: %v", tx.Error)
	}
	t.Cleanup(func() { _ = tx.Rollback().Error })

	repo := &Repository{db: pool}
	batchID := testdb.NewUUID()

	line := ProductionIngredientConsumption{
		ID:                 testdb.NewUUID(),
		BusinessID:         seeded.BusinessID,
		ProductionBatchID:  batchID,
		InventoryItemID:    testdb.NewUUID(),
		RecipeIngredientID: testdb.NewUUID(),
		ItemNameSnapshot:   "QA Flour T55",
		PlannedQuantity:    2,
		ActualQuantity:     2,
		UnitID:             testdb.NewUUID(),
		UnitCostSnapshot:   4.5,
		TotalCost:          9,
		CreatedAt:          time.Now().UTC(),
		UpdatedAt:          time.Now().UTC(),
	}
	if err := tx.Create(&line).Error; err != nil {
		t.Fatalf("insert consumption line inside transaction: %v", err)
	}

	inTx, err := repo.Ingredients(tx, batchID, seeded.BusinessID)
	if err != nil {
		t.Fatalf("Ingredients(tx): %v", err)
	}
	if len(inTx) != 1 {
		t.Fatalf("Ingredients(tx) returned %d rows, want 1 -- completeBatchTx would report "+
			"recipe_components_not_consumable for a valid recipe", len(inTx))
	}
	if inTx[0].ItemNameSnapshot != "QA Flour T55" {
		t.Fatalf("Ingredients(tx) returned %q, want %q", inTx[0].ItemNameSnapshot, "QA Flour T55")
	}

	onPool, err := repo.Ingredients(pool, batchID, seeded.BusinessID)
	if err != nil {
		t.Fatalf("Ingredients(pool): %v", err)
	}
	if len(onPool) != 0 {
		t.Fatalf("Ingredients(pool) returned %d rows, want 0 -- uncommitted rows must not "+
			"leak onto the pooled connection", len(onPool))
	}
}

// Packaging and Output share the same handle-threading contract, and
// completeBatchTx relies on Output to reject a batch that already produced.
func TestPackagingAndOutputReadThroughCallerTransaction(t *testing.T) {
	pool := testdb.Connect(t)
	seeded := testdb.Seed(t, pool)

	tx := pool.Begin()
	if tx.Error != nil {
		t.Fatalf("begin: %v", tx.Error)
	}
	t.Cleanup(func() { _ = tx.Rollback().Error })

	repo := &Repository{db: pool}
	batchID := testdb.NewUUID()
	itemID := testdb.NewUUID()

	packaging := ProductionPackagingConsumption{
		ID:                    testdb.NewUUID(),
		BusinessID:            seeded.BusinessID,
		ProductionBatchID:     batchID,
		InventoryItemID:       &itemID,
		RecipePackagingID:     testdb.NewUUID(),
		PackagingNameSnapshot: "QA Cake Box 8in",
		PlannedQuantity:       10,
		ActualQuantity:        10,
		UnitID:                testdb.NewUUID(),
		UnitCostSnapshot:      1.75,
		TotalCost:             17.5,
		CreatedAt:             time.Now().UTC(),
		UpdatedAt:             time.Now().UTC(),
	}
	if err := tx.Create(&packaging).Error; err != nil {
		t.Fatalf("insert packaging line inside transaction: %v", err)
	}

	inTx, err := repo.Packaging(tx, batchID, seeded.BusinessID)
	if err != nil {
		t.Fatalf("Packaging(tx): %v", err)
	}
	if len(inTx) != 1 {
		t.Fatalf("Packaging(tx) returned %d rows, want 1", len(inTx))
	}

	onPool, err := repo.Packaging(pool, batchID, seeded.BusinessID)
	if err != nil {
		t.Fatalf("Packaging(pool): %v", err)
	}
	if len(onPool) != 0 {
		t.Fatalf("Packaging(pool) returned %d rows, want 0", len(onPool))
	}

	output := ProductionOutput{
		ID:                testdb.NewUUID(),
		BusinessID:        seeded.BusinessID,
		ProductionBatchID: batchID,
		InventoryItemID:   itemID,
		ProductID:         testdb.NewUUID(),
		ProducedQuantity:  10,
		UnitID:            testdb.NewUUID(),
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}
	if err := tx.Create(&output).Error; err != nil {
		t.Fatalf("insert output inside transaction: %v", err)
	}

	found, err := repo.Output(tx, batchID, seeded.BusinessID)
	if err != nil {
		t.Fatalf("Output(tx): %v", err)
	}
	if found == nil {
		t.Fatal("Output(tx) returned nil -- the duplicate-output guard would not fire")
	}
}
