package shared

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// These ledger queries are assembled from SQL fragments with positional
// arguments. If the number of arguments drifts from the number of placeholders,
// every value shifts one position and the query silently returns wrong numbers
// rather than failing. Count both instead.
func TestLedgerMetricArgCountsMatchPlaceholders(t *testing.T) {
	raw, err := os.ReadFile("metrics.go")
	if err != nil {
		t.Fatalf("read metrics.go: %v", err)
	}
	source := string(raw)

	fragments := map[string]string{
		"`+branchClause":        " AND je.branch_id = ?",
		"`+accountBranchClause": " AND coa.branch_id = ?",
	}

	cases := []struct {
		fn         string
		scopedArgs int
		plainArgs  int
	}{
		// mappingKey, businessID, fallbackCode, [branch], businessID, asOfDate, [branch]
		{"LedgerMappedBalance", 7, 5},
		// mappingKey, businessID, fallbackCode, [branch], businessID, from, to, sources, [branch]
		{"LedgerMappedMovement", 9, 7},
		// businessID, from, to, sources, businessID, [branch], [branch]
		{"LedgerTaxAmount", 7, 5},
	}

	for _, tc := range cases {
		body := functionBody(source, "func "+tc.fn+"(")
		if body == "" {
			t.Errorf("%s: not found", tc.fn)
			continue
		}
		sql := regexp.MustCompile("(?s)db\\.Raw\\((.*?), args\\.\\.\\.\\)").FindStringSubmatch(body)
		if len(sql) != 2 {
			t.Errorf("%s: could not extract SQL", tc.fn)
			continue
		}

		scoped := sql[1]
		plain := sql[1]
		for marker, expansion := range fragments {
			scoped = strings.ReplaceAll(scoped, marker, expansion)
			plain = strings.ReplaceAll(plain, marker, "")
		}
		// Strip the trailing backtick left by fragment concatenation.
		scoped = strings.ReplaceAll(scoped, "+`", "")
		plain = strings.ReplaceAll(plain, "+`", "")

		if got := strings.Count(scoped, "?"); got != tc.scopedArgs {
			t.Errorf("%s branch-scoped: %d placeholders, expected %d arguments", tc.fn, got, tc.scopedArgs)
		}
		if got := strings.Count(plain, "?"); got != tc.plainArgs {
			t.Errorf("%s all-branch: %d placeholders, expected %d arguments", tc.fn, got, tc.plainArgs)
		}
	}
}

func functionBody(source, decl string) string {
	start := strings.Index(source, decl)
	if start < 0 {
		return ""
	}
	rest := source[start+len(decl):]
	end := strings.Index(rest, "\nfunc ")
	if end < 0 {
		return source[start:]
	}
	return source[start : start+len(decl)+end]
}
