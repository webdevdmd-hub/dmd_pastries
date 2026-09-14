package pos

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-006 — the POS product list carried no stock for single
// products, only for variants, so the register tile never showed "Out of
// stock" and the cashier learned about an empty shelf from the checkout
// error. Found by /qa on 2026-09-14 on production: Black Forest and Vanilla
// Cake, both stock-tracked with no inventory row, sold from the tile and were
// refused at "Confirm sale".
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
//
// The tile and the checkout must read the same row. Both POS product queries
// join inventory_items with the predicate checkout uses for a single product,
// the select carries the two quantities, and toPOSProduct exposes them only
// for stock-tracked products so an untracked item still sells without limit.
func TestPOSProductListCarriesProductLevelStock(t *testing.T) {
	repo, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	body := string(repo)

	if !strings.Contains(functionSourceIn(body, "const posProductSelect = `"), "available_stock_quantity") {
		t.Error("posProductSelect no longer selects available_stock_quantity; the tile cannot show out of stock without it")
	}
	for _, fn := range []string{
		"func (r *Repository) ListPOSProducts(",
		"func (r *Repository) FindPOSProductByID(",
	} {
		src := functionSourceIn(body, fn)
		if src == "" {
			t.Fatalf("%s not found", fn)
		}
		if !strings.Contains(src, "LEFT JOIN inventory_items ii") || !strings.Contains(src, "ii.product_variant_id IS NULL") {
			t.Errorf("%s does not join the product-level inventory row; posProductSelect reads ii.* and the register needs it", fn)
		}
	}

	svc, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	mapper := functionSourceIn(string(svc), "func toPOSProduct(")
	if !strings.Contains(mapper, "AvailableStockQuantity") {
		t.Error("toPOSProduct drops the product-level stock; the tile falls back to treating every product as in stock")
	}
	if !strings.Contains(mapper, "row.IsStockTracked") {
		t.Error("toPOSProduct must gate stock on IsStockTracked, or untracked products read as out of stock at 0")
	}
}

// functionSourceIn returns the source from the first occurrence of marker to
// the next top-level declaration (a line starting with "func " or "const ").
func functionSourceIn(body, marker string) string {
	start := strings.Index(body, marker)
	if start == -1 {
		return ""
	}
	rest := body[start:]
	after := rest[len(marker):]
	end := len(after)
	for _, stop := range []string{"\nfunc ", "\nconst ", "\ntype "} {
		if i := strings.Index(after, stop); i != -1 && i < end {
			end = i
		}
	}
	return rest[:len(marker)+end]
}
