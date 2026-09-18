package productvariants_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/productvariants"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-084 — a variant with sales, stock or recipes was deleted
// on one click, leaving its inventory row in valuation and blank variant names
// on recipes.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// DeleteVariant soft-deleted unconditionally. It now refuses a variant with
// history (409) and retires an unused variant's inventory row with it.
//
// The database is scripted (testsupport/fakesql): each case says what the
// rows are, and the test reads the statements the service really sent.

const (
	businessID = "0b6f0b8e-0000-4000-8000-000000000001"
	branchID   = "0b6f0b8e-0000-4000-8000-000000000002"
	productID  = "0b6f0b8e-0000-4000-8000-000000000005"
	variantID  = "0b6f0b8e-0000-4000-8000-000000000006"
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

// large answers as the database would for a live product with one live
// variant, Large, and one empty inventory row for it. extra answers first.
func large(extra func(fakesql.Query) (fakesql.Result, bool)) fakesql.Responder {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if extra != nil {
			if result, ok := extra(q); ok {
				return result, true
			}
		}
		switch {
		case q.Kind == "query" && q.Has(`count(*) FROM "products"`):
			return fakesql.Count(1), true
		case q.Kind == "query" && q.Has(`FROM "product_variants"`):
			return fakesql.Row(map[string]any{
				"id": variantID, "product_id": productID, "business_id": businessID,
				"variant_name": "Large", "status": "active",
			}), true
		case q.Has("FOR UPDATE") && q.Has("inventory_items"):
			return fakesql.Row(map[string]any{
				"id": "inv-3", "current_quantity": "0", "reserved_quantity": "0", "inventory_value": "0",
			}), true
		}
		return fakesql.Result{}, false
	}
}

func counting(fragments ...string) func(fakesql.Query) (fakesql.Result, bool) {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has(fragments...) {
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	}
}

func deleteLarge(t *testing.T, respond fakesql.Responder) (*fakesql.Recorder, error) {
	t.Helper()
	db, rec := fakesql.Open(t, respond)
	service := productvariants.NewService(db, productvariants.NewRepository(db), audit.NewRepository(db))
	return rec, service.DeleteVariant(owner(), productID, variantID, "127.0.0.1", "test")
}

func TestDeletingAnUnusedVariantRetiresItsInventoryRow(t *testing.T) {
	rec, err := deleteLarge(t, large(nil))
	if err != nil {
		t.Fatalf("an unused variant must delete; got %v\n%s", err, rec.Dump())
	}
	retired := rec.Writes(`UPDATE "inventory_items"`, `"deleted_at"`)
	if len(retired) != 1 || !retired[0].InTx || !retired[0].HasArg(variantID) {
		t.Fatalf("the variant's inventory row must be soft-deleted in the delete's transaction; statements:\n%s", rec.Dump())
	}
	if len(rec.Writes(`UPDATE "product_variants"`, `"deleted_at"`)) != 1 || !rec.Committed() {
		t.Fatalf("the variant itself must be soft-deleted and committed:\n%s", rec.Dump())
	}
}

func TestVariantWithHistoryIsRefusedWith409(t *testing.T) {
	cases := []struct {
		name    string
		respond fakesql.Responder
		mention string
	}{
		{"a sale", large(counting("sale_items")), "sales"},
		{"a bakery order", large(counting("bakery_order_items")), "bakery orders"},
		{"a recipe that makes it", large(counting("FROM recipes", "product_variant_id")), "a recipe that makes it"},
		{"a recipe that uses it", large(counting("recipe_ingredients", "component_variant_id")), "recipes using it"},
		{"stock movements", large(counting("stock_movements")), "stock movements"},
		{"stock on hand", large(func(q fakesql.Query) (fakesql.Result, bool) {
			if q.Has("FOR UPDATE") && q.Has("inventory_items") {
				return fakesql.Row(map[string]any{
					"id": "inv-3", "current_quantity": "6", "reserved_quantity": "0", "inventory_value": "90",
				}), true
			}
			return fakesql.Result{}, false
		}), "stock on hand"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec, err := deleteLarge(t, tc.respond)

			var appErr *apperrors.AppError
			if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
				t.Fatalf("a variant with %s must be refused with 409; got %v", tc.name, err)
			}
			if !strings.Contains(appErr.Message, "Large") || !strings.Contains(appErr.Message, tc.mention) {
				t.Fatalf("the refusal must name the variant and what holds it (%q); got %q", tc.mention, appErr.Message)
			}
			if len(rec.Writes("UPDATE")) != 0 || rec.Committed() {
				t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
			}
		})
	}
}
