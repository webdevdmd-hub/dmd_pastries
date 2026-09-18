package ingredients_test

import (
	"testing"

	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-091 — an ingredient on a deleted recipe could never be
// deleted.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// Recipe delete left its lines live, and the in-use check counted every live
// line. Butter's only line here belongs to a deleted recipe, so a check that
// joins recipes and skips deleted ones finds nothing.

func TestLineOfADeletedRecipeDoesNotBlockIngredientDelete(t *testing.T) {
	rec, err := deleteButter(t, butter(func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has("recipe_ingredients") {
			if q.Has("r.deleted_at IS NULL") {
				return fakesql.Count(0), true
			}
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	}))
	if err != nil {
		t.Fatalf("a line of a deleted recipe must not refuse the delete; got %v\n%s", err, rec.Dump())
	}
	if len(rec.Writes(`UPDATE "ingredients"`, `"deleted_at"`)) != 1 {
		t.Fatalf("the ingredient must be deleted:\n%s", rec.Dump())
	}
}
