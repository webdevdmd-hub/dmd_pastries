package accounting

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-007 — a completed bakery order posted revenue with no cost of sales.
//
// Cost of sales is summed from the stock movements an order made, never from
// the product record. An item that moved nothing therefore cost nothing. That
// is right for a custom cake, which was never coming off a shelf, and wrong for
// a stock-tracked catalog product with no inventory item on the order's branch:
// consumption skipped it, cost came out zero, and the order posted revenue with
// no cost against it. Margin was overstated by the item's cost and inventory
// never went negative, so neither half of the discrepancy left a mark.
//
// Proven live on 2026-09-14, on production, with a control:
//
//	ORD-000003  Vanilla Cake, stock tracked, cost 250.00, none on hand, no
//	            inventory item  ->  revenue 357.00, NO cost journal
//	ORD-000004  Black Forest, stock tracked, 3 on hand  ->  revenue 351.00,
//	            cost 270.00, stock 3 to 2
//
// The owner chose to price those items from the product record rather than
// refuse completion or let stock go negative (D2, option A, 2026-09-14), so the
// ledger knowingly relieves inventory no stock record supports. That trade is
// only acceptable while the gap stays visible, which is what the amount in the
// journal line description and the warning log are for.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestBakeryOrderCOGSPricesItemsThatRelievedNoStock(t *testing.T) {
	service, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	posting := functionSource(string(service), "func (s *Service) PostBakeryOrderCOGSJournal(")
	if posting == "" {
		t.Fatal("PostBakeryOrderCOGSJournal not found")
	}

	if !strings.Contains(posting, "SumBakeryOrderUncostedItemCost") {
		t.Fatal("PostBakeryOrderCOGSJournal must price the items that relieved no stock; " +
			"without it a stock-tracked product with no inventory item posts revenue and no cost")
	}

	// The fallback is worthless if the function gives up before reaching it.
	// This was the shape of the bug: a bare `if costTotal <= 0 { return }` on
	// the movement sum alone, which returned before anything else was consulted.
	fallback := strings.Index(posting, "SumBakeryOrderUncostedItemCost")
	abandon := strings.Index(posting, "COGS journal skipped")
	if !strings.Contains(posting, "SumStockMovementCostByReference") || abandon == -1 {
		t.Fatal("expected the movement sum and the zero-cost bail-out to both be present")
	}
	if fallback > abandon {
		t.Error("the zero-cost bail-out runs before the items that relieved no stock are priced, " +
			"so the fallback can never fire and the COGS gap is still silent")
	}

	// Both halves must reach the total. A mixed order -- some items consumed,
	// some not -- has to be costed once and in full, not one or the other.
	if !strings.Contains(posting, "movedCost + uncostedCost") {
		t.Error("costTotal must sum the movement cost AND the priced items; an order where only " +
			"some items relieved stock is still short by the rest")
	}

	// The trade the owner accepted is a correct margin with a VISIBLE gap. If
	// the amount stops reaching the journal, the gap is silent again and the
	// trade no longer holds.
	if !strings.Contains(posting, "priced from the product record") {
		t.Error("the journal line must say how much of the cost has no stock movement behind it; " +
			"that visibility is the condition the fallback was accepted under")
	}

	repo, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	query := functionSource(string(repo), "func (r *Repository) SumBakeryOrderUncostedItemCost(")
	if query == "" {
		t.Fatal("SumBakeryOrderUncostedItemCost not found")
	}

	for _, want := range []struct {
		fragment string
		why      string
	}{
		{"boi.product_id IS NOT NULL",
			"a custom item has no product and genuinely costs nothing; pricing it would invent a cost"},
		{"p.is_stock_tracked = TRUE",
			"an untracked product is not supposed to relieve stock, so its zero cost is correct"},
		{"ii.id IS NULL",
			"only items with NO inventory item may be priced this way; an item that has one already " +
				"contributed through its movement and would otherwise be counted twice"},
		{"cost_price",
			"the fallback price is the product's own cost, which is the whole point of the fallback"},
		{"boi.business_id = ? AND boi.bakery_order_id = ?",
			"the sum must be scoped to one order in one business"},
	} {
		if !strings.Contains(query, want.fragment) {
			t.Errorf("the query is missing %q: %s", want.fragment, want.why)
		}
	}

	if !strings.Contains(query, "ii.branch_id = ?") {
		t.Error("inventory items are per branch, so the absence must be judged on the ORDER's branch; " +
			"without it an item stocked at another branch looks present here")
	}
}

// functionSource returns one function's text, ending at whichever declaration
// comes next. Newlines are normalised first: this repo checks out CRLF, and a
// "\nfunc " probe against "\r\nfunc " is a coin toss nobody should be flipping.
func functionSource(body, marker string) string {
	body = strings.ReplaceAll(body, "\r\n", "\n")
	start := strings.Index(body, marker)
	if start == -1 {
		return ""
	}
	rest := body[start:]
	after := rest[len(marker):]
	end := len(after)
	for _, stop := range []string{"\nfunc ", "\ntype ", "\nconst ", "\nvar "} {
		if i := strings.Index(after, stop); i != -1 && i < end {
			end = i
		}
	}
	return rest[:len(marker)+end]
}
