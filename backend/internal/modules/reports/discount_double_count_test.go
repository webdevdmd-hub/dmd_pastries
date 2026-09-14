package reports

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-013 — the discount report counted every discount twice.
//
// A sale-level discount is allocated INTO each line at checkout:
//
//	items[i].DiscountAmount = roundMoney(items[i].DiscountAmount + allocatedSaleDiscount)
//
// and the sale header is then the sum of those lines:
//
//	DiscountAmount: roundMoney(sumDiscounts(items))
//
// So sales.discount_amount and SUM(sale_items.discount_amount) are the same
// money at two granularities, never two separate pools. The report added them,
// and therefore reported exactly twice every discount ever given.
//
// Measured on production on 2026-09-14, on one comped sale whose only discount
// was a single 100% sale-level discount of 351.00:
//
//	Total Discount        AED 702.00
//	Sale-Level Discount   AED 351.00
//	Line-Level Discount   AED 351.00
//	Discounted Sales      1
//	row SALE-…-000002     Discount AED 702.00, Sale total AED 0.00
//
// 702.00 of discount on a sale that grossed 351.00, and the same doubled figure
// reached the Sales overview as "Discount Total". This overstates margin given
// away on every promotion, not only on comps.
//
// The split is not recoverable from what is stored, because the allocation
// OVERWRITES the line's own discount rather than sitting beside it. One honest
// total beats two figures that are each the whole amount under a label calling
// them parts of it, so the split is gone rather than guessed at.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestDiscountReportDoesNotDoubleCount(t *testing.T) {
	raw, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")

	if strings.Contains(source, "summary.SaleLevelDiscount + summary.LineLevelDiscount") {
		t.Error("the discount total adds the sale header to the line sum, but the header IS the line " +
			"sum: every discount is reported twice")
	}

	if strings.Contains(source, "(s.discount_amount + COALESCE(SUM(si.discount_amount),0))") {
		t.Error("a discount report ROW adds the sale header to its own lines, so each row shows " +
			"twice the discount that sale actually gave")
	}
}

// The split cards are gone from the response because the data cannot support
// them. If either field comes back, something is claiming a breakdown that the
// allocation destroyed at checkout.
func TestDiscountReportDoesNotClaimASplitItCannotDerive(t *testing.T) {
	raw, err := os.ReadFile("dto.go")
	if err != nil {
		t.Fatalf("read dto.go: %v", err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(source, "type DiscountReportResponse struct {")
	if start == -1 {
		t.Fatal("DiscountReportResponse not found")
	}
	end := strings.Index(source[start:], "\n}")
	if end == -1 {
		end = len(source) - start
	}
	declaration := source[start : start+end]

	for _, field := range []string{"sale_level_discount", "line_level_discount"} {
		if strings.Contains(declaration, field) {
			t.Errorf("DiscountReportResponse exposes %s, but a sale-level discount is allocated into "+
				"the lines at checkout and overwrites their own discount, so the split cannot be "+
				"derived from what is stored. Reinstating it means reinstating a number that is "+
				"either the whole total or a guess", field)
		}
	}
}
