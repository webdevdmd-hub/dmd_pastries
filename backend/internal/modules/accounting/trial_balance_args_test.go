package accounting

import (
	"io"
	"os"
	"regexp"
	"strings"
	"testing"
)

// The trial-balance query is assembled from fragments and its arguments are
// positional, so a mismatch between the two silently shifts every placeholder.
// Count them instead of trusting the reading.
func TestTrialBalanceArgCountMatchesPlaceholders(t *testing.T) {
	source, err := readSourceFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}

	body := functionBody(source, "func (r *Repository) ListTrialBalanceRows(")
	if body == "" {
		t.Fatal("ListTrialBalanceRows not found")
	}

	// The SQL is a raw string concatenated with fragment variables, so it
	// contains backticks; take everything up to the argument list.
	raw := regexp.MustCompile("(?s)r\\.db\\.Raw\\((.*?), trialBalanceArgs\\(").FindStringSubmatch(body)
	if len(raw) != 2 {
		t.Fatal("could not extract the trial balance SQL")
	}

	// Fragments are interpolated as `+name+`; substitute their literal values.
	query := strings.ReplaceAll(raw[1], "`+branchFilter+`", "AND je.branch_id = ?")
	query = strings.ReplaceAll(query, "`+accountBranchFilter+`", "AND coa.branch_id = ?")

	placeholders := strings.Count(query, "?")

	args := trialBalanceArgs("business-id", TrialBalanceQuery{
		BranchID: "11111111-1111-4111-8111-111111111111",
		DateFrom: "2026-01-01",
		DateTo:   "2026-01-31",
	}, true)

	if placeholders != len(args) {
		t.Fatalf("branch-scoped trial balance: %d placeholders but %d arguments", placeholders, len(args))
	}

	// And without a branch, where both fragments collapse to nothing.
	unscoped := strings.ReplaceAll(raw[1], "`+branchFilter+`", "")
	unscoped = strings.ReplaceAll(unscoped, "`+accountBranchFilter+`", "")
	unscopedArgs := trialBalanceArgs("business-id", TrialBalanceQuery{
		DateFrom: "2026-01-01",
		DateTo:   "2026-01-31",
	}, false)
	if got := strings.Count(unscoped, "?"); got != len(unscopedArgs) {
		t.Fatalf("all-branch trial balance: %d placeholders but %d arguments", got, len(unscopedArgs))
	}
}

func readSourceFile(name string) (string, error) {
	file, err := os.Open(name)
	if err != nil {
		return "", err
	}
	defer file.Close()
	raw, err := io.ReadAll(file)
	return string(raw), err
}

func functionBody(source, decl string) string {
	start := strings.Index(source, decl)
	if start < 0 {
		return ""
	}
	end := strings.Index(source[start+len(decl):], "\nfunc ")
	if end < 0 {
		return source[start:]
	}
	return source[start : start+len(decl)+end]
}
