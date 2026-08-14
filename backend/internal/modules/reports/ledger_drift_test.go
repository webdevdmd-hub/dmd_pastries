package reports

import (
	"os"
	"strings"
	"testing"
)

func TestLedgerDriftWarningsSilentWhenSourcesAgree(t *testing.T) {
	warnings := ledgerDriftWarnings([]ledgerDriftCheck{
		{Metric: "gross_sales", Ledger: 1000, Operational: 1000},
		// Per-line rounding between two independent summations is not drift.
		{Metric: "total_collected", Ledger: 500.02, Operational: 500},
	})
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %#v", warnings)
	}
}

func TestLedgerDriftWarningsReportsRealDifference(t *testing.T) {
	warnings := ledgerDriftWarnings([]ledgerDriftCheck{
		{Metric: "gross_sales", Ledger: 900, Operational: 1000},
	})
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}
	warning := warnings[0]
	if warning.Code != "operational_ledger_drift_gross_sales" {
		t.Fatalf("unexpected code %q", warning.Code)
	}
	// Both figures must be in the message, or the operator cannot tell which
	// side is wrong.
	if !strings.Contains(warning.Message, "900.00") || !strings.Contains(warning.Message, "1000.00") {
		t.Fatalf("warning message must carry both figures: %q", warning.Message)
	}
}

func TestLedgerDriftWarningsFlagsDriftInBothDirections(t *testing.T) {
	warnings := ledgerDriftWarnings([]ledgerDriftCheck{
		{Metric: "ledger_high", Ledger: 1200, Operational: 1000},
		{Metric: "ledger_low", Ledger: 800, Operational: 1000},
	})
	if len(warnings) != 2 {
		t.Fatalf("drift must be reported whichever side is larger, got %d warnings", len(warnings))
	}
}

// The financial summary and the dashboard must read the same ledger totals,
// or they drift apart again exactly as they did before Phase 5 / W4.
func TestFinancialSummaryAndDashboardBothReadLedgerTotals(t *testing.T) {
	source, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository source: %v", err)
	}
	text := string(source)

	// Each function must call one of these ledger readers and report drift.
	// OutstandingBalancesHeader/SupplierPayablesHeader need a single control
	// balance, so they use LedgerMappedBalance rather than the full totals.
	required := map[string]string{
		"FinancialSummary":          "shared.LedgerFinancialTotals(",
		"paymentsSummary":           "shared.LedgerFinancialTotals(",
		"OutstandingBalancesHeader": "shared.LedgerMappedBalance(",
		"SupplierPayablesHeader":    "shared.LedgerMappedBalance(",
	}
	for name, ledgerCall := range required {
		index := strings.Index(text, "func (r *Repository) "+name+"(")
		if index < 0 {
			t.Fatalf("%s not found", name)
		}
		body := text[index:]
		if end := strings.Index(body[1:], "\nfunc "); end > 0 {
			body = body[:end]
		}
		if !strings.Contains(body, ledgerCall) {
			t.Fatalf("%s must read its money figures from the ledger (%s)", name, ledgerCall)
		}
		if !strings.Contains(body, "ledgerDriftWarnings(") {
			t.Fatalf("%s must report drift against the operational tables", name)
		}
	}
}

// The dead shadow copy of the ledger totals struct must not come back.
func TestNoShadowLedgerTotalsStruct(t *testing.T) {
	source, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository source: %v", err)
	}
	if strings.Contains(string(source), "type ledgerFinancialTotals struct") {
		t.Fatal("reports must use shared.FinancialTotals, not a local shadow copy")
	}
}
