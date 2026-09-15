package reports

import (
	"testing"

	"pastries-pos/internal/modules/reports/shared"
)

// Regression: ISSUE-018 — applying a report filter raised false ledger drift.
//
// Filtering Financial Reports by Card on 2026-09-15 raised, word for word:
//
//	gross_sales differs between the ledger (2118.00) and the operational tables
//	(0.00); difference 2118.00. Run the accounting backfill or check for missing
//	journals.
//
// The operational queries honoured the payment method; the ledger, which knows
// nothing about payment methods, did not. The two figures were answering
// different questions, and the page told the operator to run a backfill over a
// filter they had just applied themselves.
//
// This reproduces that exact case, so it fails with the production message if
// the guard in ledgerDriftWarnings is removed.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestFilteredReportsDoNotReportDriftTheLedgerCannotSee(t *testing.T) {
	cardOnly := &shared.ResolvedFilter{PaymentMethodID: "card"}
	warnings := ledgerDriftWarnings(cardOnly, []ledgerDriftCheck{
		{Metric: "gross_sales", Ledger: 2118, Operational: 0},
		{Metric: "total_collected", Ledger: 601, Operational: 0},
	})
	if len(warnings) != 0 {
		t.Fatalf("a payment method filter narrows the operational side only, so this is not drift, "+
			"but it raised %d warning(s), first: %s", len(warnings), warnings[0].Message)
	}

	// The guard must not swallow REAL drift. Unfiltered, the same gap is exactly
	// what the panel exists to catch -- it is how ISSUE-017 was found.
	unfiltered := ledgerDriftWarnings(&shared.ResolvedFilter{}, []ledgerDriftCheck{
		{Metric: "total_collected", Ledger: 601, Operational: 852},
	})
	if len(unfiltered) != 1 {
		t.Fatalf("with no filter a 251.00 gap is genuine drift and must be reported, got %d warnings",
			len(unfiltered))
	}
}
