package accounting

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Period-lock policy (Phase 5 / W1): every function that writes or
// soft-deletes journal rows must call one of the accounting.EnsurePeriodOpen*
// guards in its own body, or be explicitly allowlisted with a rationale.
// This walks every module so new posting paths are born compliant.
//
// Functions whose only journal writes go through createPostedSystemJournal /
// createPostedTransferJournal are covered by the guard inside those choke
// points and never match here (they don't touch repo.CreateJournalEntry
// themselves).
var periodLockGuardAllowlist = map[string]string{
	// The repository methods are plain data access; the lock decision is the
	// calling service's. Every service caller is checked instead.
	"(Repository).CreateJournalEntry":               "data-access layer; callers hold the guard",
	"(Repository).SoftDeleteJournalEntry":           "data-access layer; callers hold the guard",
	"(Repository).SoftDeleteJournalEntries":         "data-access layer; callers hold the guard",
	"(Repository).SoftDeleteSupplierPaymentJournal": "data-access layer; callers hold the guard",
}

var journalWriterSelectors = map[string]bool{
	"CreateJournalEntry":               true,
	"SoftDeleteJournalEntry":           true,
	"SoftDeleteJournalEntries":         true,
	"SoftDeleteSupplierPaymentJournal": true,
}

func TestEveryJournalWriterChecksPeriodLock(t *testing.T) {
	modulesDir := ".."
	fset := token.NewFileSet()
	var offenders []string

	err := filepath.Walk(modulesDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		file, parseErr := parser.ParseFile(fset, path, nil, 0)
		if parseErr != nil {
			return parseErr
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				continue
			}
			writes, guarded := inspectFunctionForPeriodLock(fn)
			if !writes || guarded {
				continue
			}
			key := functionKey(fn)
			if _, allowed := periodLockGuardAllowlist[key]; allowed {
				continue
			}
			offenders = append(offenders, path+": "+key)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk modules: %v", err)
	}
	if len(offenders) > 0 {
		t.Fatalf("journal-writing functions must call accounting.EnsurePeriodOpen* or be allowlisted with a rationale (period-lock policy, Phase 5):\n%s", strings.Join(offenders, "\n"))
	}
}

// inspectFunctionForPeriodLock reports whether fn writes/soft-deletes journal
// rows through a repository, and whether it calls a period-lock guard.
func inspectFunctionForPeriodLock(fn *ast.FuncDecl) (writesJournals, callsGuard bool) {
	ast.Inspect(fn.Body, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		switch callee := call.Fun.(type) {
		case *ast.SelectorExpr:
			name := callee.Sel.Name
			if strings.HasPrefix(name, "EnsurePeriodOpen") {
				callsGuard = true
			}
			// Only repository-level writes count ("s.repo.X", "r.db.X" is raw
			// SQL and out of scope); service methods that happen to share a
			// name (h.service.CreateJournalEntry) must not match.
			if journalWriterSelectors[name] && selectorReceiverContainsRepo(callee.X) {
				writesJournals = true
			}
		case *ast.Ident:
			if strings.HasPrefix(callee.Name, "EnsurePeriodOpen") {
				callsGuard = true
			}
		}
		return true
	})
	return writesJournals, callsGuard
}

func selectorReceiverContainsRepo(expr ast.Expr) bool {
	switch receiver := expr.(type) {
	case *ast.Ident:
		return strings.Contains(strings.ToLower(receiver.Name), "repo") || receiver.Name == "r"
	case *ast.SelectorExpr:
		return strings.Contains(strings.ToLower(receiver.Sel.Name), "repo")
	default:
		return false
	}
}

func functionKey(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return fn.Name.Name
	}
	receiverType := ""
	switch t := fn.Recv.List[0].Type.(type) {
	case *ast.StarExpr:
		if ident, ok := t.X.(*ast.Ident); ok {
			receiverType = ident.Name
		}
	case *ast.Ident:
		receiverType = t.Name
	}
	return "(" + receiverType + ")." + fn.Name.Name
}
