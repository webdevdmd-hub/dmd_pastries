package pos

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// stock_movements has never had a deleted_at column (migrations 000017/000035;
// reports/shared/metrics_test.go guards the same invariant for the consistency
// queries). A deleted_at predicate makes Postgres reject the whole query, which
// crashed VoidSale for every stock-tracked item.
func TestSaleStockMovementUnitCostQueryDoesNotReferenceDeletedAt(t *testing.T) {
	body := saleStockMovementUnitCostSource(t)
	if !strings.Contains(body, `Table("stock_movements")`) {
		t.Fatal("saleStockMovementUnitCost no longer queries stock_movements; update this guard")
	}
	if strings.Contains(body, "deleted_at") {
		t.Fatalf("saleStockMovementUnitCost must not reference deleted_at; stock_movements is not soft-deleted:\n%s", body)
	}
}

func saleStockMovementUnitCostSource(t *testing.T) string {
	t.Helper()
	src, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	match := regexp.MustCompile(`(?s)func \(s \*Service\) saleStockMovementUnitCost.*?\n}`).Find(src)
	if match == nil {
		t.Fatal("saleStockMovementUnitCost not found in service.go")
	}
	return string(match)
}
