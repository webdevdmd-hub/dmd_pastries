package accounting

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"sort"
	"strings"
	"testing"
)

// Migration 000092 made chart_of_accounts and accounting_account_mappings
// branch-scoped: account codes and mapping keys are now unique per
// (business_id, branch_id), so a lookup keyed only on business_id matches one
// row per branch and returns an arbitrary one. Journals then post to another
// branch's accounts while their header carries the correct branch.
//
// This test asserts every repository method touching those tables takes a
// branchID and filters on it. The allowlist below is the set of methods not yet
// converted; it must only ever shrink. Do not add to it.
var branchBlindAccountQueryAllowlist = map[string]string{
	// Reads a single account by primary key; callers that need branch
	// confinement use the branch-aware FindByIDForBranch instead.
	"FindByID": "id lookup, guarded by FindByIDForBranch at the call sites that need it",
	// Enriches an already branch-checked payment account with its chart account.
	"LoadPaymentAccountResponse": "display enrichment for a payment account already scoped by its caller",
	// Branch comes from the mapping struct and is validated there, so the
	// signature carries no separate branchID parameter.
	"UpsertAccountMapping": "branch taken from mapping.BranchID, which is rejected when empty",
}

func TestAccountQueriesAreBranchScoped(t *testing.T) {
	const path = "repository.go"

	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}

	fileSet := token.NewFileSet()
	parsed, err := parser.ParseFile(fileSet, path, source, 0)
	if err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}

	// Both the raw table names and the gorm models that map to them: the
	// resolution primitives reach these tables through models, not SQL.
	branchScopedTables := []string{
		"chart_of_accounts", "accounting_account_mappings",
		"ChartAccount", "AccountMapping",
	}
	violations := []string{}
	unusedAllowlist := map[string]bool{}
	for name := range branchBlindAccountQueryAllowlist {
		unusedAllowlist[name] = true
	}

	for _, decl := range parsed.Decls {
		function, ok := decl.(*ast.FuncDecl)
		if !ok || function.Body == nil {
			continue
		}

		body := string(source[fileSet.Position(function.Body.Pos()).Offset:fileSet.Position(function.Body.End()).Offset])
		touchesAccounts := false
		for _, table := range branchScopedTables {
			if strings.Contains(body, table) {
				touchesAccounts = true
				break
			}
		}
		if !touchesAccounts {
			continue
		}
		// Only single-row resolution is in scope here. Report aggregates read
		// these tables too, but they scope through journal_entries.branch_id
		// and their own filter structs; they are covered by the report tests.
		if !resolvesSingleAccount(body) {
			continue
		}

		name := function.Name.Name
		hasBranchParam := functionHasBranchParam(function)
		hasBranchPredicate := strings.Contains(body, "branch_id")

		if hasBranchParam && hasBranchPredicate {
			if branchBlindAccountQueryAllowlist[name] != "" {
				t.Errorf("%s is branch-scoped now; remove it from branchBlindAccountQueryAllowlist", name)
			}
			continue
		}

		delete(unusedAllowlist, name)
		if _, allowed := branchBlindAccountQueryAllowlist[name]; allowed {
			continue
		}

		missing := []string{}
		if !hasBranchParam {
			missing = append(missing, "no branchID parameter")
		}
		if !hasBranchPredicate {
			missing = append(missing, "no branch_id predicate")
		}
		violations = append(violations, name+" ("+strings.Join(missing, ", ")+")")
	}

	sort.Strings(violations)
	for _, violation := range violations {
		t.Errorf("branch-blind account query: %s", violation)
	}
	for name := range unusedAllowlist {
		t.Errorf("branchBlindAccountQueryAllowlist entry %q no longer matches any method; remove it", name)
	}
}

// resolvesSingleAccount reports whether the body fetches one account/mapping row,
// which is the lookup shape that silently picks an arbitrary branch's copy.
func resolvesSingleAccount(body string) bool {
	for _, terminal := range []string{".First(", ".Take(", ".Last("} {
		if strings.Contains(body, terminal) {
			return true
		}
	}
	return false
}

func functionHasBranchParam(function *ast.FuncDecl) bool {
	if function.Type.Params == nil {
		return false
	}
	for _, field := range function.Type.Params.List {
		for _, name := range field.Names {
			if strings.Contains(strings.ToLower(name.Name), "branch") {
				return true
			}
		}
	}
	return false
}
