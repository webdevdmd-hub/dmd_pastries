package shared

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOutstandingSaleConditionMatchesRevenueScope(t *testing.T) {
	condition := OutstandingSaleCondition("s")
	// A partially-refunded sale still carries a receivable; scoping AR to
	// completed-only was the source of permanent reconciliation drift.
	if !strings.Contains(condition, "partially_refunded") {
		t.Fatalf("outstanding sales must include partially-refunded sales: %q", condition)
	}
	if !strings.Contains(condition, "(s.total_amount - s.paid_amount) > 0") {
		t.Fatalf("outstanding sales must require an unpaid balance: %q", condition)
	}
}

func TestOutstandingConditionsQualifyWithAlias(t *testing.T) {
	if !strings.Contains(OutstandingBakeryOrderCondition("bo"), "bo.order_status") {
		t.Fatal("bakery condition must qualify with the given alias")
	}
	if strings.Contains(OutstandingBakeryOrderCondition(""), ".order_status") {
		t.Fatal("an empty alias must produce unqualified columns")
	}
	if !strings.Contains(OutstandingPurchaseInvoiceCondition("pi"), "pi.status = 'posted'") {
		t.Fatal("only posted bills are payables")
	}
}

// Guard: the outstanding-balance predicates existed in three incompatible
// copies before Phase 5 / W4. Every consumer must import them from here.
func TestNoModuleRedeclaresOutstandingPredicates(t *testing.T) {
	modulesDir := filepath.Join("..", "..")
	banned := []string{
		`payment_status IN ('unpaid','partial')`,
		`payment_status IN ?", businessID, branchID, customerID, "voided"`,
		// The supplier-payables report carried its own copy of the payable
		// scope and paired it with status <> 'cancelled', which admits DRAFT
		// bills into an accounts-payable figure. Only posted bills are
		// liabilities, so this guaranteed drift against the ledger.
		`payment_status IN ('unpaid','partial','overdue')`,
	}
	var offenders []string
	err := filepath.Walk(modulesDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		// This file's own definitions are the source of truth.
		if strings.HasSuffix(path, filepath.Join("reports", "shared", "predicates.go")) {
			return nil
		}
		source, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		for _, pattern := range banned {
			if strings.Contains(string(source), pattern) {
				offenders = append(offenders, path+": "+pattern)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk modules: %v", err)
	}
	if len(offenders) > 0 {
		t.Fatalf("outstanding-balance predicates must come from reports/shared/predicates.go:\n%s", strings.Join(offenders, "\n"))
	}
}
