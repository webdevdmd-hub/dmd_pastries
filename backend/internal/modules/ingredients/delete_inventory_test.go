package ingredients_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/ingredients"
	"pastries-pos/internal/modules/inventory"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-083 — ingredient delete was refused whenever the
// ingredient had an inventory row, which creating it always makes.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// Creating an ingredient creates its inventory row, so "refuse if any
// inventory row exists" refused almost every delete. The rule now: an empty
// row that never moved goes with the ingredient; stock history or a recipe
// using the ingredient refuses the delete with 409.
//
// The database is scripted (testsupport/fakesql): each case says what the
// rows are, and the test reads the statements the service really sent.

const (
	businessID   = "0b6f0b8e-0000-4000-8000-000000000001"
	branchID     = "0b6f0b8e-0000-4000-8000-000000000002"
	ingredientID = "0b6f0b8e-0000-4000-8000-000000000003"
)

func owner() *utils.AuthContext {
	branch := branchID
	return &utils.AuthContext{
		UserID:           "0b6f0b8e-0000-4000-8000-000000000009",
		BusinessID:       businessID,
		CurrentBranchID:  &branch,
		AllowedBranchIDs: []string{branchID},
	}
}

// butter answers as the database would for one live ingredient, Butter, with
// one live, empty inventory row. extra answers first, for the case's own rows.
func butter(extra func(fakesql.Query) (fakesql.Result, bool)) fakesql.Responder {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if extra != nil {
			if result, ok := extra(q); ok {
				return result, true
			}
		}
		switch {
		case q.Kind == "query" && q.Has(`FROM "ingredients"`):
			return fakesql.Row(map[string]any{
				"id": ingredientID, "business_id": businessID, "branch_id": branchID,
				"ingredient_name": "Butter", "status": "active",
			}), true
		// The inventory row itself: locked for the delete, or counted.
		case q.Has("FOR UPDATE") && q.Has("inventory_items"):
			return fakesql.Row(map[string]any{
				"id": "inv-1", "current_quantity": "0", "reserved_quantity": "0", "inventory_value": "0",
			}), true
		case q.Has(`count(*) FROM "inventory_items"`):
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	}
}

func deleteButter(t *testing.T, respond fakesql.Responder) (*fakesql.Recorder, error) {
	t.Helper()
	db, rec := fakesql.Open(t, respond)
	service := ingredients.NewService(db, ingredients.NewRepository(db), inventory.NewRepository(db), audit.NewRepository(db))
	return rec, service.Delete(owner(), ingredientID, "127.0.0.1", "test")
}

func TestDeletingAnUnusedIngredientRetiresItsEmptyInventoryRow(t *testing.T) {
	rec, err := deleteButter(t, butter(nil))
	if err != nil {
		t.Fatalf("an ingredient whose only inventory row is empty and unmoved must delete; got %v\n%s", err, rec.Dump())
	}

	retired := rec.Writes(`UPDATE "inventory_items"`, `"deleted_at"`)
	if len(retired) != 1 {
		t.Fatalf("the ingredient's inventory row must be soft-deleted with it; statements:\n%s", rec.Dump())
	}
	if !retired[0].InTx || !retired[0].HasArg(ingredientID) {
		t.Fatalf("the inventory row must be retired for this ingredient inside the delete's transaction: %+v", retired[0])
	}
	if len(rec.Writes(`UPDATE "ingredients"`, `"deleted_at"`)) != 1 || !rec.Committed() {
		t.Fatalf("the ingredient itself must be soft-deleted and committed:\n%s", rec.Dump())
	}
}

func TestIngredientWithHistoryIsRefusedWith409(t *testing.T) {
	cases := []struct {
		name    string
		table   string
		mention string
	}{
		{"stock movements", "stock_movements", "stock movements"},
		{"expiry batches", "expiry_batches", "expiry batches"},
		{"an open purchase order", "purchase_order_items", "purchase documents"},
		{"a recipe line", "recipe_ingredients", "recipes using it"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec, err := deleteButter(t, butter(func(q fakesql.Query) (fakesql.Result, bool) {
				if q.Kind == "query" && q.Has(tc.table) {
					return fakesql.Count(2), true
				}
				return fakesql.Result{}, false
			}))

			var appErr *apperrors.AppError
			if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
				t.Fatalf("an ingredient with %s must be refused with 409; got %v", tc.name, err)
			}
			if !strings.Contains(appErr.Message, "Butter") || !strings.Contains(appErr.Message, tc.mention) {
				t.Fatalf("the refusal must name the ingredient and what holds it (%q); got %q", tc.mention, appErr.Message)
			}
			if len(rec.Writes("UPDATE")) != 0 || rec.Committed() {
				t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
			}
		})
	}
}

func TestIngredientWithStockOnHandIsRefused(t *testing.T) {
	rec, err := deleteButter(t, butter(func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Has("FOR UPDATE") && q.Has("inventory_items") {
			return fakesql.Row(map[string]any{
				"id": "inv-1", "current_quantity": "4.5", "reserved_quantity": "0", "inventory_value": "22.50",
			}), true
		}
		return fakesql.Result{}, false
	}))

	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict || !strings.Contains(appErr.Message, "stock on hand") {
		t.Fatalf("an ingredient with stock on hand must be refused with 409 naming it; got %v", err)
	}
	if len(rec.Writes("UPDATE")) != 0 {
		t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
	}
}
