package masterdata

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-089 — an ingredient or packaging category named like one
// in another branch failed with a 500.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The duplicate check looked in the current branch only, but migration
// 000005's unique index is on (business_id, lower(category_name)), so the
// INSERT hit the index. The scripted database holds "Dairy" in another branch
// and rejects the INSERT the way the index would.

func TestCategoryNameUsedByAnotherBranchIsA409(t *testing.T) {
	branchID := "0b6f0b8e-0000-4000-8000-000000000002"
	db, rec := fakesql.Open(t, func(q fakesql.Query) (fakesql.Result, bool) {
		switch {
		case q.Kind == "query" && q.Has("ingredient_categories", "count("):
			// "Dairy" lives in another branch: a check narrowed to this
			// branch does not see it.
			if q.HasArg(branchID) {
				return fakesql.Count(0), true
			}
			return fakesql.Count(1), true
		case q.Has(`INSERT INTO "ingredient_categories"`):
			return fakesql.Fail(`ERROR: duplicate key value violates unique constraint "idx_ingredient_categories_business_name_active" (SQLSTATE 23505)`), true
		}
		return fakesql.Result{}, false
	})
	service := NewService(db, NewRepository(db), audit.NewRepository(db))
	owner := &utils.AuthContext{
		UserID:           "0b6f0b8e-0000-4000-8000-000000000009",
		BusinessID:       "0b6f0b8e-0000-4000-8000-000000000001",
		CurrentBranchID:  &branchID,
		AllowedBranchIDs: []string{branchID},
	}

	_, err := service.CreateSimpleCategory(owner, ingredientConfig(), CreateSimpleCategoryRequest{CategoryName: "Dairy"}, "127.0.0.1", "test")

	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("a name another branch already uses must be a 409; got %v\n%s", err, rec.Dump())
	}
	if !strings.Contains(appErr.Message, "shared by all branches") {
		t.Fatalf("the refusal must say names are business-wide; got %q", appErr.Message)
	}
	if len(rec.Matching("INSERT")) != 0 {
		t.Fatalf("the duplicate must be caught before the INSERT:\n%s", rec.Dump())
	}
}
