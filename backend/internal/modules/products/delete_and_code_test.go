package products_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/products"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-086 — product codes were reissued after a delete, a
// deleted product's variants kept their SKUs, and the history check missed a
// product used as a recipe component.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// NextProductCode counted live products and added one, so after a delete it
// handed out a code already in use. DeleteProduct soft-deleted the product
// alone. Its history check looked only at rows naming the product as the
// thing sold, stocked or made, not as an ingredient of something else.
//
// The database is scripted (testsupport/fakesql): each case says what the
// rows are, and the test reads the statements the service really sent.

const (
	businessID = "0b6f0b8e-0000-4000-8000-000000000001"
	branchID   = "0b6f0b8e-0000-4000-8000-000000000002"
	productID  = "0b6f0b8e-0000-4000-8000-000000000005"
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

func TestNextProductCodeNeverReissuesADeletedProductsCode(t *testing.T) {
	// The business has had PRD-000001..PRD-000003; 1 and 3 were deleted, so one
	// product is live. Counting live rows gives PRD-000002 -- the live one.
	db, rec := fakesql.Open(t, func(q fakesql.Query) (fakesql.Result, bool) {
		switch {
		case q.Has("MAX("):
			return fakesql.Count(3), true
		case q.Has(`count(*) FROM "products"`):
			return fakesql.Count(1), true
		}
		return fakesql.Result{}, false
	})

	code, err := products.NewRepository(db).NextProductCode(businessID, branchID)
	if err != nil {
		t.Fatalf("NextProductCode: %v", err)
	}
	if code != "PRD-000004" {
		t.Fatalf("the next code must follow the highest ever issued, deleted products included; got %s\n%s", code, rec.Dump())
	}
	for _, q := range rec.Statements() {
		if q.Has("deleted_at") {
			t.Fatalf("numbering must not skip soft-deleted products: %s", q.SQL)
		}
	}
}

// brownie answers for one live product with no history. extra answers first.
func brownie(extra func(fakesql.Query) (fakesql.Result, bool)) fakesql.Responder {
	return func(q fakesql.Query) (fakesql.Result, bool) {
		if extra != nil {
			if result, ok := extra(q); ok {
				return result, true
			}
		}
		if q.Kind == "query" && q.Has(`FROM "products"`) {
			return fakesql.Row(map[string]any{
				"id": productID, "business_id": businessID, "branch_id": branchID,
				"product_name": "Brownie", "product_code": "PRD-000002", "status": "active",
			}), true
		}
		return fakesql.Result{}, false
	}
}

func deleteBrownie(t *testing.T, respond fakesql.Responder) (*fakesql.Recorder, error) {
	t.Helper()
	db, rec := fakesql.Open(t, respond)
	service := products.NewService(db, products.NewRepository(db), audit.NewRepository(db))
	return rec, service.DeleteProduct(owner(), productID, "127.0.0.1", "test")
}

func TestDeletingAProductRetiresItsVariants(t *testing.T) {
	rec, err := deleteBrownie(t, brownie(nil))
	if err != nil {
		t.Fatalf("a product with no history must delete; got %v\n%s", err, rec.Dump())
	}
	retired := rec.Writes(`UPDATE "product_variants"`, `"deleted_at"`)
	if len(retired) != 1 || !retired[0].InTx || !retired[0].HasArg(productID) {
		t.Fatalf("the product's variants must be soft-deleted in the product's transaction:\n%s", rec.Dump())
	}
	if !rec.Committed() {
		t.Fatalf("the delete must commit:\n%s", rec.Dump())
	}
}

func TestProductUsedAsAComponentCannotBeDeleted(t *testing.T) {
	cases := []struct{ name, fragment, reference string }{
		{"on a live recipe", "recipe_ingredients", "recipe_components"},
		{"consumed in production", "production_ingredient_consumptions", "production_consumptions"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec, err := deleteBrownie(t, brownie(func(q fakesql.Query) (fakesql.Result, bool) {
				if q.Has(tc.fragment, "component_product_id") {
					return fakesql.Count(1), true
				}
				return fakesql.Result{}, false
			}))

			var appErr *apperrors.AppError
			if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
				t.Fatalf("a product used as a component must be refused with 409; got %v", err)
			}
			details, _ := appErr.Details.(map[string]interface{})
			references, _ := details["references"].([]products.ProductHistoryReference)
			found := false
			for _, reference := range references {
				found = found || reference.Reference == tc.reference
			}
			if details["reason"] != "product_has_history" || !found {
				t.Fatalf("the refusal must report %s as product history; got %+v", tc.reference, appErr.Details)
			}
			if !strings.Contains(appErr.Message, "Archive it instead") {
				t.Fatalf("the refusal must point at Archive, the action that keeps history; got %q", appErr.Message)
			}
			if len(rec.Writes("UPDATE")) != 0 {
				t.Fatalf("a refused delete must change nothing:\n%s", rec.Dump())
			}
		})
	}
}
