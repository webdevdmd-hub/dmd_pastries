package products

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-006 — the register showed no "Out of stock" badge, so a
// stock-tracked product with nothing on hand sold from the tile and was only
// refused at "Confirm sale".
//
// Found by /qa on 2026-09-14, and then found AGAIN on 2026-09-14 after the
// first fix changed nothing on screen. That second finding is the reason this
// file exists and is worth stating plainly:
//
//	The counter reads GET /api/v1/products/pos, which is THIS module
//	(Handler.POSProducts -> Service.POSProducts -> Repository.POSProducts,
//	returning ProductResponse). It does NOT read GET /api/v1/pos/products,
//	the similarly named route in the pos module. Commit 8c9618b fixed the pos
//	module's copy, its own guard passed, and the live payload still carried no
//	available_stock_quantity because the register never calls that route.
//
// So this guard asserts on the path the register uses. The pos module keeps
// its own guard for its own endpoint; neither substitutes for the other.
//
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
func TestPOSProductsCarryBranchStock(t *testing.T) {
	dto, err := os.ReadFile("dto.go")
	if err != nil {
		t.Fatalf("read dto.go: %v", err)
	}
	response := declarationSource(string(dto), "type ProductResponse struct {")
	if response == "" {
		t.Fatal("ProductResponse not found")
	}
	for _, field := range []string{"AvailableStockQuantity", "CurrentStockQuantity"} {
		if !strings.Contains(response, field) {
			t.Errorf("ProductResponse has no %s; the register reads the quantity off this response "+
				"and treats its absence as an unlimited product", field)
		}
	}
	if !strings.Contains(response, "AvailableStockQuantity *float64") {
		t.Error("AvailableStockQuantity must be a pointer: 0 (counted, none left) and nil " +
			"(not stock tracked, sell freely) are different answers and a plain float64 conflates them")
	}

	repo, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	lookup := declarationSource(string(repo), "func (r *Repository) ProductStockByProductID(")
	if lookup == "" {
		t.Fatal("ProductStockByProductID not found; POSProducts needs a batched stock lookup")
	}
	if !strings.Contains(lookup, "product_variant_id IS NULL") {
		t.Error("the stock lookup must match the product-level inventory row, the same row the " +
			"checkout consults; without the variant predicate it can pick up a variant's row")
	}
	if !strings.Contains(lookup, "product_id IN ?") {
		t.Error("the stock lookup must take every product in one query; a per-product lookup " +
			"inside the response loop is what starved the connection pooler in ISSUE-005")
	}

	svc, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	posProducts := declarationSource(string(svc), "func (s *Service) POSProducts(")
	if posProducts == "" {
		t.Fatal("Service.POSProducts not found")
	}
	if !strings.Contains(posProducts, "ProductStockByProductID") {
		t.Error("Service.POSProducts does not attach branch stock, so every tile in the register " +
			"reads as sellable regardless of what is on the shelf")
	}
	if !strings.Contains(posProducts, "IsStockTracked") {
		t.Error("POSProducts must gate the quantities on IsStockTracked, or an untracked product " +
			"reports 0 and cannot be sold at all")
	}
}

// declarationSource returns the source from marker to the next top-level
// declaration.
func declarationSource(body, marker string) string {
	start := strings.Index(body, marker)
	if start == -1 {
		return ""
	}
	rest := body[start:]
	after := rest[len(marker):]
	end := len(after)
	for _, stop := range []string{"\nfunc ", "\ntype ", "\nconst "} {
		if i := strings.Index(after, stop); i != -1 && i < end {
			end = i
		}
	}
	return rest[:len(marker)+end]
}
