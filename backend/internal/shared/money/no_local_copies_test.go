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

// The decimal library stays behind money.Amount. A module importing it
// directly would be free to pick its own rounding mode and its own JSON
// representation -- and a raw decimal.Decimal in a DTO marshals as a quoted
// string by default, which the frontend reads as 0. Amount owns those
// decisions so they can only be made once.
func TestOnlyTheMoneyPackageImportsTheDecimalLibrary(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	offenders := []string{}
	err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		slashed := filepath.ToSlash(path)
		if strings.Contains(slashed, "internal/shared/money/") {
			return nil
		}
		source, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if strings.Contains(string(source), `"github.com/shopspring/decimal"`) {
			offenders = append(offenders, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	if len(offenders) > 0 {
		t.Fatalf("use money.Amount instead of importing the decimal library directly:\n%s",
			strings.Join(offenders, "\n"))
	}
}

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
