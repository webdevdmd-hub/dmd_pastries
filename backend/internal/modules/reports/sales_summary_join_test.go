package reports

import (
	"os"
	"strings"
	"testing"

	"pastries-pos/internal/modules/reports/shared"
)

// readRepositoryFunction returns the source text of one repository function, so
// a structural invariant can be asserted without a database.
func readRepositoryFunction(t *testing.T, decl string) string {
	t.Helper()
	raw, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	source := string(raw)
	start := strings.Index(source, decl)
	if start < 0 {
		t.Fatalf("function not found: %s", decl)
	}
	rest := source[start+len(decl):]
	end := strings.Index(rest, "\nfunc ")
	if end < 0 {
		return source[start:]
	}
	return source[start : start+len(decl)+end]
}

// Header amounts must never be summed across a join to sale_items: that
// multiplies every total by the number of lines on the sale, inflating the
// sales summary, the dashboard, and every KPI derived from them.
func TestSalesSummaryDoesNotSumHeadersAcrossLineJoin(t *testing.T) {
	body := readRepositoryFunction(t, "func (r *Repository) salesReportSummaryForRange(")

	if !strings.Contains(body, "WITH scoped_sales AS") {
		t.Error("salesReportSummaryForRange no longer scopes sales in a CTE")
	}
	if strings.Contains(body, "LEFT JOIN sale_items si ON si.sale_id = s.id") {
		t.Error("salesReportSummaryForRange joins sale_items to the sales header again")
	}
	// Line-grained values must still come from sale_items.
	if !strings.Contains(body, "line_totals AS") || !strings.Contains(body, "SUM(si.quantity)") {
		t.Error("salesReportSummaryForRange no longer aggregates quantity from sale_items")
	}
}

// The same defect existed in five sibling queries. Guard the whole file rather
// than the one function, so it cannot be reintroduced anywhere.
func TestNoReportSumsSaleHeadersAcrossLineJoin(t *testing.T) {
	raw, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}

	headerAmounts := []string{
		"SUM(s.total_amount)",
		"SUM(s.subtotal_amount)",
		"SUM(s.tax_amount)",
		"SUM(s.discount_amount)",
	}

	for _, block := range strings.Split(string(raw), "\nfunc ") {
		if !strings.Contains(block, "LEFT JOIN sale_items si ON si.sale_id = s.id") {
			continue
		}
		name := strings.SplitN(block, "(", 2)[0]
		for _, amount := range headerAmounts {
			if strings.Contains(block, amount) {
				t.Errorf("%s: %s is summed across a sale_items join, which multiplies it by the line count",
					strings.TrimSpace(name), amount)
			}
		}
	}
}

// The query is assembled from three fragments and its arguments are positional,
// so a count mismatch silently shifts every value rather than failing.
func TestSalesSummaryArgCountMatchesPlaceholders(t *testing.T) {
	cases := []struct {
		name   string
		filter *shared.ResolvedFilter
	}{
		{"no filters", &shared.ResolvedFilter{BusinessID: "b", AllBranches: true}},
		{"branch only", &shared.ResolvedFilter{BusinessID: "b", BranchID: "br"}},
		{"product", &shared.ResolvedFilter{BusinessID: "b", BranchID: "br", ProductID: "p"}},
		{"category", &shared.ResolvedFilter{BusinessID: "b", BranchID: "br", CategoryID: "c"}},
		{"product and category", &shared.ResolvedFilter{
			BusinessID: "b", BranchID: "br", ProductID: "p", CategoryID: "c",
		}},
		{"all filters", &shared.ResolvedFilter{
			BusinessID: "b", BranchID: "br", ProductID: "p", CategoryID: "c",
			CashierUserID: "u", PaymentStatus: "paid", SaleStatus: "completed",
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			headerWhere := "s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ?"
			headerArgs := []interface{}{"b", "from", "to"}
			headerWhere, headerArgs = addHeaderSalesFilters(headerWhere, headerArgs, tc.filter)

			existsSQL, existsArgs := salesLineScopeExists("s", tc.filter)
			lineSQL, lineArgs := salesLineDirectFilter(tc.filter)

			query := headerWhere + existsSQL + lineSQL
			args := append(append(headerArgs, existsArgs...), lineArgs...)

			if got, want := strings.Count(query, "?"), len(args); got != want {
				t.Fatalf("%d placeholders but %d arguments", got, want)
			}
		})
	}
}

// Without a product or category filter there is nothing to restrict, so the
// EXISTS must disappear entirely rather than becoming a no-op subquery.
func TestSalesLineScopeExistsIsEmptyWithoutLineFilters(t *testing.T) {
	fragment, args := salesLineScopeExists("s", &shared.ResolvedFilter{BusinessID: "b"})
	if fragment != "" || len(args) != 0 {
		t.Fatalf("expected no fragment, got %q with %d args", fragment, len(args))
	}
}
