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

	// Every discount total must be ONE sum, never a sum of two.
	//
	// Listing known-bad strings was not enough, twice over. The first fix
	// covered the Discount Report; the Sales overview kept reading 702.00 from
	// a second query; and after that was fixed a THIRD copy was still live in
	// the sales summary, written with subqueries so the literal patterns sailed
	// straight past it:
	//
	//	COALESCE((SELECT SUM(discount_amount) FROM scoped_sales),0)
	//	  + COALESCE((SELECT line_discount FROM line_totals),0) AS discount_total
	//
	// So the rule is structural now. A discount total is a single figure: the
	// sale header, which already IS the line sum. Any "+" in an expression
	// aliased AS discount_total means two pools are being added, and there is
	// only ever one pool.
	for _, expression := range discountTotalExpressions(source) {
		if strings.Contains(expression, "+") {
			t.Errorf("a discount total is built by adding two amounts, but the sale header IS the "+
				"line sum, so this reports every discount twice: %s",
				strings.Join(strings.Fields(expression), " "))
		}
	}
}

// discountTotalExpressions returns each SQL select expression aliased
// AS discount_total.
//
// It scans BACKWARDS tracking parenthesis depth, because the commas that
// separate select items look identical to the commas inside COALESCE(x, 0).
// A naive LastIndex(",") lands inside the nearest COALESCE and returns a
// fragment like "0)", which contains no "+" and quietly passes -- which is
// exactly how the first version of this guard missed two live double counts.
func discountTotalExpressions(source string) []string {
	const alias = "AS discount_total"
	expressions := []string{}
	for index := 0; ; {
		found := strings.Index(source[index:], alias)
		if found == -1 {
			return expressions
		}
		found += index
		start := 0
		depth := 0
		for at := found - 1; at >= 0; at-- {
			switch source[at] {
			case ')':
				depth++
			case '(':
				if depth == 0 {
					start = at + 1
					at = 0
					continue
				}
				depth--
			case ',':
				if depth == 0 {
					start = at + 1
					at = 0
					continue
				}
			}
			if start != 0 {
				break
			}
			// A SELECT at depth zero also opens the expression list.
			if depth == 0 && at >= len("SELECT") && source[at-len("SELECT"):at] == "SELECT" {
				start = at
				break
			}
		}
		expressions = append(expressions, source[start:found])
		index = found + len(alias)
	}
}
