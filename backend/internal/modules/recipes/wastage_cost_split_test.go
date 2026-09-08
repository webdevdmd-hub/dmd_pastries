package recipes

import "testing"

// The figures are the QA Vanilla Sponge recipe that exposed this: flour 2 kg at
// 4.50 with 10% wastage, butter 1 kg at 22.00, sugar 1.5 kg at 3.20, milk 1 ltr
// at 6.00, plus 10 boxes at 1.75 packaging, yielding 10.
//
// The recipe screen showed 6.02 per unit and every production and ledger screen
// showed 5.93, with nothing saying why. Both are right: 6.02 is what a unit
// costs to make including expected loss, 5.93 is what a finished unit is
// carried at, because production expenses the 0.90 to Wastage Expense rather
// than capitalising it. The split has to reconcile exactly or the screens go
// back to contradicting each other.
func TestRecipeWastageCostReconcilesMakeCostWithInventoryValue(t *testing.T) {
	ingredients := []RecipeIngredient{
		{QuantityRequired: 2, UnitCostSnapshot: 4.50, WastagePercentage: 10},
		{QuantityRequired: 1, UnitCostSnapshot: 22.00},
		{QuantityRequired: 1.5, UnitCostSnapshot: 3.20},
		{QuantityRequired: 1, UnitCostSnapshot: 6.00},
	}

	wastageCost := recipeWastageCost(ingredients)
	if wastageCost != 0.90 {
		t.Fatalf("wastage cost = %.2f, want 0.90 (2kg at 4.50, 10%% wasted)", wastageCost)
	}

	const makeCostTotal = 60.20 // 42.70 ingredients incl. wastage + 17.50 packaging
	inventoryTotal := roundMoney(makeCostTotal - wastageCost)
	if inventoryTotal != 59.30 {
		t.Fatalf("inventory total = %.2f, want 59.30 -- this is the figure production "+
			"writes to stock and posts to WIP", inventoryTotal)
	}

	const yield = 10.0
	if got := roundQuantity(makeCostTotal / yield); got != 6.02 {
		t.Errorf("cost per unit = %v, want 6.02", got)
	}
	if got := roundQuantity(inventoryTotal / yield); got != 5.93 {
		t.Errorf("inventory value per unit = %v, want 5.93", got)
	}
}

func TestRecipeWastageCostIsZeroWithoutWastage(t *testing.T) {
	ingredients := []RecipeIngredient{
		{QuantityRequired: 2, UnitCostSnapshot: 4.50},
		{QuantityRequired: 1, UnitCostSnapshot: 22.00},
	}

	// With no wastage the two numbers are the same, and the recipe screen
	// shows one line rather than a split that says nothing.
	if got := recipeWastageCost(ingredients); got != 0 {
		t.Errorf("wastage cost = %v, want 0", got)
	}
}

// Rounding happens per line, the way the stored line totals do, so the split
// adds back to the recipe total exactly rather than drifting a cent.
func TestRecipeWastageCostRoundsPerLine(t *testing.T) {
	ingredients := []RecipeIngredient{
		{QuantityRequired: 0.333, UnitCostSnapshot: 7.77, WastagePercentage: 7.5},
		{QuantityRequired: 1.111, UnitCostSnapshot: 3.33, WastagePercentage: 12.5},
	}

	wastageCost := recipeWastageCost(ingredients)

	expected := 0.0
	for _, line := range ingredients {
		withWastage := roundMoney(line.QuantityRequired * (1 + line.WastagePercentage/100) * line.UnitCostSnapshot)
		withoutWastage := roundMoney(line.QuantityRequired * line.UnitCostSnapshot)
		expected = roundMoney(expected + roundMoney(withWastage-withoutWastage))
	}
	if wastageCost != expected {
		t.Errorf("wastage cost = %v, want %v", wastageCost, expected)
	}
}
