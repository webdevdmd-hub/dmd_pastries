package accounting

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Safe-delete policy (audit K3): posted ledger history must never be
// physically destroyed. Documents may be deleted Zoho-style, but their
// journals are soft-deleted so the audit trail survives. This guard walks
// every module and fails if any Go file hard-deletes journal rows.
func TestNoModuleHardDeletesJournalRows(t *testing.T) {
	modulesDir := ".."
	unscopedDelete := regexp.MustCompile(`Unscoped\(\)[^\n]*(\n[^\n]*){0,4}Delete\(&(accounting\.)?(JournalEntry|JournalEntryLine)\{\}`)
	var offenders []string
	err := filepath.Walk(modulesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		src, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if unscopedDelete.Match(src) {
			offenders = append(offenders, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk modules: %v", err)
	}
	if len(offenders) > 0 {
		t.Fatalf("journal rows must be soft-deleted, never Unscoped-deleted (safe-delete policy): %v", offenders)
	}
}
