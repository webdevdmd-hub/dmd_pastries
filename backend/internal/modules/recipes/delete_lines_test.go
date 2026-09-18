package recipes_test

import (
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/recipes"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-091 — deleting a recipe left its ingredient and packaging
// lines live, and they kept the ingredients on them from being deleted.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The ingredient and packaging sides (lines of a deleted recipe no longer
// count as uses) are pinned in their own packages' deleted_recipe_lines tests.

func TestDeletingARecipeDeletesItsLinesInTheSameTransaction(t *testing.T) {
	const (
		businessID = "0b6f0b8e-0000-4000-8000-000000000001"
		branchID   = "0b6f0b8e-0000-4000-8000-000000000002"
		recipeID   = "0b6f0b8e-0000-4000-8000-00000000000b"
	)
	db, rec := fakesql.Open(t, nil)
	service := recipes.NewService(db, recipes.NewRepository(db), audit.NewRepository(db))
	branch := branchID
	owner := &utils.AuthContext{
		UserID:           "0b6f0b8e-0000-4000-8000-000000000009",
		BusinessID:       businessID,
		CurrentBranchID:  &branch,
		AllowedBranchIDs: []string{branchID},
	}

	if err := service.Delete(owner, recipeID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("Delete: %v\n%s", err, rec.Dump())
	}
	for _, table := range []string{`UPDATE "recipe_ingredients"`, `UPDATE "recipe_packaging"`} {
		lines := rec.Writes(table, `"deleted_at"`)
		if len(lines) != 1 || !lines[0].InTx || !lines[0].HasArg(recipeID) {
			t.Fatalf("%s must soft-delete this recipe's lines inside the delete's transaction:\n%s", table, rec.Dump())
		}
	}
	if !rec.Committed() {
		t.Fatalf("the delete must commit:\n%s", rec.Dump())
	}
}
