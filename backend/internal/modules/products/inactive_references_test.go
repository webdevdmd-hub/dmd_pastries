package products_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/products"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/testsupport/fakesql"
)

// Regression: ISSUE-089 — an inactive category refused every save of a
// product already filed under it, while an inactive unit was accepted for any
// product.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The rule now: an inactive category or unit is accepted only when it is the
// product's current one; choosing one anew is a 400 that says why.
//
// The scripted database holds one product, Brownie, filed under an inactive
// category and unit, plus an active category and unit.

const (
	inactiveCategory = "0b6f0b8e-0000-4000-8000-0000000000c1"
	activeCategory   = "0b6f0b8e-0000-4000-8000-0000000000c2"
	inactiveUnit     = "0b6f0b8e-0000-4000-8000-0000000000a1"
	activeUnit       = "0b6f0b8e-0000-4000-8000-0000000000a2"
)

func statusOf(q fakesql.Query, inactiveID, activeID string) (string, bool) {
	switch {
	case q.HasArg(inactiveID):
		return "inactive", true
	case q.HasArg(activeID):
		return "active", true
	}
	return "", false
}

// referenceRows answers the way the database would for the rows above,
// whether the service reads a status, counts active rows, or loads a name.
func referenceRows(q fakesql.Query) (fakesql.Result, bool) {
	if q.Kind != "query" {
		return fakesql.Result{}, false
	}
	var status string
	var known bool
	switch {
	case q.Has(`FROM "product_categories"`):
		status, known = statusOf(q, inactiveCategory, activeCategory)
	case q.Has(`FROM "units"`):
		status, known = statusOf(q, inactiveUnit, activeUnit)
	case q.Has("product_category_allowed_types"):
		return fakesql.Count(1), true
	case q.Has(`FROM "products"`) && !q.Has("count(") && !q.Has("MAX("):
		return fakesql.Row(map[string]any{
			"id": productID, "business_id": businessID, "branch_id": branchID,
			"product_name": "Brownie", "product_code": "PRD-000002", "product_type": "finished_product",
			"category_id": inactiveCategory, "unit_id": inactiveUnit, "status": "active",
		}), true
	default:
		return fakesql.Result{}, false
	}
	if !known {
		return fakesql.Result{}, false
	}
	switch {
	case q.Has("count("):
		// A count filtered on status = 'active' does not see an inactive row.
		if q.HasArg("active") && status != "active" {
			return fakesql.Count(0), true
		}
		return fakesql.Count(1), true
	case q.Has("category_name") || q.Has("unit_name"):
		return fakesql.Row(map[string]any{"id": "ref", "category_name": "Cakes", "category_code": "CAKES", "unit_name": "Piece", "symbol": "pc"}), true
	default:
		return fakesql.Row(map[string]any{"status": status}), true
	}
}

func referenceService(t *testing.T) *products.Service {
	t.Helper()
	db, _ := fakesql.Open(t, referenceRows)
	return products.NewService(db, products.NewRepository(db), audit.NewRepository(db))
}

func badRequestSaying(t *testing.T, err error, words string) {
	t.Helper()
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusBadRequest || !strings.Contains(appErr.Message, words) {
		t.Fatalf("want a 400 saying %q; got %v", words, err)
	}
}

func TestEditingAProductKeepsItsNowInactiveCategoryAndUnit(t *testing.T) {
	_, err := referenceService(t).UpdateProduct(owner(), productID, products.UpdateProductRequest{
		ProductName: "Brownie slab",
		CategoryID:  inactiveCategory,
		UnitID:      inactiveUnit,
		ProductType: "finished_product",
	}, "127.0.0.1", "test")
	if err != nil {
		t.Fatalf("renaming a product filed under a since-deactivated category and unit must save; got %v", err)
	}
}

func TestMovingAProductIntoAnInactiveCategoryIsRefused(t *testing.T) {
	// Give the product the active category first, then ask for the inactive one.
	db, _ := fakesql.Open(t, func(q fakesql.Query) (fakesql.Result, bool) {
		if q.Kind == "query" && q.Has(`FROM "products"`) && !q.Has("count(") {
			return fakesql.Row(map[string]any{
				"id": productID, "business_id": businessID, "branch_id": branchID,
				"product_name": "Brownie", "product_type": "finished_product",
				"category_id": activeCategory, "unit_id": activeUnit, "status": "active",
			}), true
		}
		return referenceRows(q)
	})
	service := products.NewService(db, products.NewRepository(db), audit.NewRepository(db))

	_, err := service.UpdateProduct(owner(), productID, products.UpdateProductRequest{
		CategoryID: inactiveCategory, ProductType: "finished_product",
	}, "127.0.0.1", "test")
	badRequestSaying(t, err, "category is inactive")
}

func TestCreatingAProductWithAnInactiveUnitIsRefused(t *testing.T) {
	_, err := referenceService(t).CreateProduct(owner(), products.CreateProductRequest{
		ProductName: "Blondie",
		CategoryID:  activeCategory,
		UnitID:      inactiveUnit,
		ProductType: "finished_product",
	}, "127.0.0.1", "test")
	badRequestSaying(t, err, "unit is inactive")
}
