package packaging_test

import (
	"testing"

	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-091 — a packaging item on a deleted recipe counted as in
// use.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The cake box's only recipe line belongs to a deleted recipe, so a check that
// joins recipes and skips deleted ones finds nothing.

func TestLineOfADeletedRecipeDoesNotBlockPackagingDelete(t *testing.T) {
	rec, err := deleteCakeBox(t, cakeBox(func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has("recipe_packaging") {
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
	if len(rec.Writes(`UPDATE "packaging_items"`, `"deleted_at"`)) != 1 {
		t.Fatalf("the packaging item must be deleted:\n%s", rec.Dump())
	}
}
