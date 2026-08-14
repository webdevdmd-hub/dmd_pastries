package money

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// The rounding helper had been copied into eighteen packages, byte-identical,
// plus five differently-named variants -- roundCustomerMoney,
// roundDashboardMoney, roundExpenseMoney, roundMetricMoney,
// roundSupplierMoney. Nothing could change without the copies silently
// disagreeing, and the float64 -> decimal migration would have had to edit
// every one of them.
//
// This guard keeps them collapsed: a module may keep a local name for
// readability, but its body must delegate here.
var localRoundingImplementation = regexp.MustCompile(`math\.Round\(\s*\w+\s*\*\s*(100|10000)\s*\)\s*/\s*(100|10000)`)

func TestNoModuleReimplementsMoneyRounding(t *testing.T) {
	root := filepath.Join("..", "..", "..", "internal")
	if _, err := os.Stat(root); err != nil {
		t.Fatalf("cannot locate internal directory at %s: %v", root, err)
	}

	offenders := []string{}
	err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		// This package is the implementation, and its own tests compare
		// against the previous behaviour on purpose.
		if strings.Contains(filepath.ToSlash(path), "internal/shared/money/") {
			return nil
		}
		source, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if localRoundingImplementation.Match(source) {
			offenders = append(offenders, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	if len(offenders) > 0 {
		t.Fatalf("money rounding must come from internal/shared/money, not be reimplemented in:\n%s",
			strings.Join(offenders, "\n"))
	}
}
