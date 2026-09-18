package packaging_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/inventory"
	"pastries-pos/internal/modules/packaging"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-083 — deleting a packaging item left its inventory row
// live in the inventory list, stock valuation and low-stock alerts.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// Delete checked only product packaging rules. The rule now matches
// ingredients: an empty row that never moved goes with the item; stock
// history, a recipe line or a packaging rule refuses the delete with 409.
//
// The database is scripted (testsupport/fakesql): each case says what the
// rows are, and the test reads the statements the service really sent.

const (
	businessID  = "0b6f0b8e-0000-4000-8000-000000000001"
	branchID    = "0b6f0b8e-0000-4000-8000-000000000002"
	packagingID = "0b6f0b8e-0000-4000-8000-000000000004"
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

// cakeBox answers as the database would for one live packaging item, Cake
// box, with one live inventory row. extra answers first, for the case's own
// rows.
func cakeBox(extra func(fakesql.Query) (fakesql.Result, bool)) fakesql.Responder {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if extra != nil {
			if result, ok := extra(q); ok {
				return result, true
			}
		}
		switch {
		case q.Kind == "query" && q.Has(`FROM "packaging_items"`):
			return fakesql.Row(map[string]any{
				"id": packagingID, "business_id": businessID, "branch_id": branchID,
				"packaging_name": "Cake box", "status": "active",
			}), true
		case q.Has("FOR UPDATE") && q.Has("inventory_items"):
			return fakesql.Row(map[string]any{
				"id": "inv-2", "current_quantity": "0", "reserved_quantity": "0", "inventory_value": "0",
			}), true
		}
		return fakesql.Result{}, false
	}
}

func countOn(table string) func(fakesql.Query) (fakesql.Result, bool) {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has(table) {
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	}
}

func deleteCakeBox(t *testing.T, respond fakesql.Responder) (*fakesql.Recorder, error) {
	t.Helper()
	db, rec := fakesql.Open(t, respond)
	service := packaging.NewService(db, packaging.NewRepository(db), inventory.NewRepository(db), audit.NewRepository(db))
	return rec, service.Delete(owner(), packagingID, "127.0.0.1", "test")
}

func TestDeletingUnusedPackagingRetiresItsInventoryRow(t *testing.T) {
	rec, err := deleteCakeBox(t, cakeBox(nil))
	if err != nil {
		t.Fatalf("an unused packaging item must delete; got %v\n%s", err, rec.Dump())
	}

	retired := rec.Writes(`UPDATE "inventory_items"`, `"deleted_at"`)
	if len(retired) != 1 {
		t.Fatalf("the packaging item's inventory row must be soft-deleted with it; statements:\n%s", rec.Dump())
	}
	if !retired[0].InTx || !retired[0].HasArg(packagingID) {
		t.Fatalf("the inventory row must be retired for this item inside the delete's transaction: %+v", retired[0])
	}
	if len(rec.Writes(`UPDATE "packaging_items"`, `"deleted_at"`)) != 1 || !rec.Committed() {
		t.Fatalf("the packaging item itself must be soft-deleted and committed:\n%s", rec.Dump())
	}
}

func TestPackagingInUseIsRefusedWith409(t *testing.T) {
	cases := []struct {
		name    string
		respond fakesql.Responder
		mention string
	}{
		{"stock movements", cakeBox(countOn("stock_movements")), "stock movements"},
		{"a purchase receipt", cakeBox(countOn("purchase_receipt_items")), "purchase documents"},
		{"a recipe line", cakeBox(countOn("recipe_packaging")), "recipes using it"},
		{"a product packaging rule", cakeBox(countOn("packaging_usage_rules")), "product packaging rules"},
		{"stock on hand", cakeBox(func(q fakesql.Query) (fakesql.Result, bool) {
			if q.Has("FOR UPDATE") && q.Has("inventory_items") {
				return fakesql.Row(map[string]any{
					"id": "inv-2", "current_quantity": "120", "reserved_quantity": "0", "inventory_value": "60",
				}), true
			}
			return fakesql.Result{}, false
		}), "stock on hand"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec, err := deleteCakeBox(t, tc.respond)

			var appErr *apperrors.AppError
			if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
				t.Fatalf("packaging with %s must be refused with 409; got %v", tc.name, err)
			}
			if !strings.Contains(appErr.Message, "Cake box") || !strings.Contains(appErr.Message, tc.mention) {
				t.Fatalf("the refusal must name the item and what holds it (%q); got %q", tc.mention, appErr.Message)
			}
			if len(rec.Writes("UPDATE")) != 0 || rec.Committed() {
				t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
			}
		})
	}
}
