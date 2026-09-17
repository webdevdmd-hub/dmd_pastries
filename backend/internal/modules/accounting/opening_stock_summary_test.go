package accounting

import (
	"strings"
	"testing"
)

// Regression: ISSUE-053 — Opening Balances showed 3400 "Unallocated 1,350.00"
// with every category at 0.00. The 1,350.00 was opening stock, which credits
// 3400 through the inventory module and had no line in the summary. Measured
// on production (Jo_bakes, Main Branch) on 2026-09-17.
func TestOpeningBalanceSummaryIncludesOpeningStock(t *testing.T) {
	summary := functionSource(readAccountingFile(t, "opening_balances.go"), "func (s *Service) GetOpeningBalanceSummary(")
	if !strings.Contains(summary, "s.repo.SumOpeningStockValue(") || !strings.Contains(summary, "OpeningStockTotal:") {
		t.Error("the opening balance summary must report opening stock, the part of 3400 the inventory module posts")
	}
	repo := functionSource(readAccountingFile(t, "repository.go"), "func (r *Repository) SumOpeningStockValue(")
	for _, want := range []string{"movement_type = 'opening_stock'", "is_reversal = FALSE", "is_reversed = FALSE", "SUM(total_cost)"} {
		if !strings.Contains(repo, want) {
			t.Errorf("SumOpeningStockValue must total live opening-stock movements; missing %q", want)
		}
	}
}

// The ledger narration read "Inventory movement opening_stock".
func TestInventoryJournalNarrationIsReadable(t *testing.T) {
	service := readAccountingFile(t, "service.go")
	if strings.Contains(service, `"Inventory movement "+movement.MovementType`) {
		t.Error(`inventory journals are narrated with the raw movement type again ("opening_stock")`)
	}
}
