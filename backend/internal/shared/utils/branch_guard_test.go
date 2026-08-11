package utils

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// CanAccessBranch answers allowed-set membership and ignores the branch the
// caller is actually operating in. Used as a record guard it lets a user who
// was transferred between branches keep reaching their old branch's data,
// because user_branch_access rows are never revoked. EnsureRecordBranch is the
// correct guard for a record.
//
// These are the per-file budgets for remaining CanAccessBranch uses. They must
// only ever shrink. Converting a guard to EnsureRecordBranch lowers the count;
// lower the budget in the same change.
//
// Every remaining use is a genuine membership question, not a record guard:
//
//	accounting/service.go   validates a chart account a caller nominated
//	products/pricing.go     filters a price-suggestion list by membership
//	masterdata/service.go   copies categories between branches, cross-branch by design
//	users/service.go        validates which branch a user may be assigned to
//	salesreturns/service.go validates a client-supplied branch_id filter
//	businesses/service.go   switch-branch, which cannot require you to already be there
//	branches/service.go     reading a branch's own details
var canAccessBranchBudget = map[string]int{
	"accounting/service.go":   3,
	"products/pricing.go":     2,
	"masterdata/service.go":   2,
	"users/service.go":        1,
	"salesreturns/service.go": 1,
	"businesses/service.go":   1,
	"branches/service.go":     1,
}

func TestCanAccessBranchUsageDoesNotGrow(t *testing.T) {
	root := filepath.Join("..", "..", "modules")

	counts := map[string]int{}
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		source, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		occurrences := strings.Count(string(source), "CanAccessBranch(")
		if occurrences == 0 {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		counts[filepath.ToSlash(relative)] = occurrences
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", root, err)
	}

	names := make([]string, 0, len(counts))
	for name := range counts {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		budget, tracked := canAccessBranchBudget[name]
		if !tracked {
			t.Errorf("%s: %d new CanAccessBranch use(s); guard records with EnsureRecordBranch instead",
				name, counts[name])
			continue
		}
		if counts[name] > budget {
			t.Errorf("%s: CanAccessBranch uses grew from %d to %d; guard records with EnsureRecordBranch instead",
				name, budget, counts[name])
		}
		if counts[name] < budget {
			t.Errorf("%s: CanAccessBranch uses dropped from %d to %d; lower the budget in canAccessBranchBudget",
				name, budget, counts[name])
		}
	}

	for name := range canAccessBranchBudget {
		if _, present := counts[name]; !present {
			t.Errorf("canAccessBranchBudget entry %q no longer has any uses; remove it", name)
		}
	}
}
