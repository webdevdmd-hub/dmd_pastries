package reports

import (
	"fmt"
	"math"

	"pastries-pos/internal/modules/reports/shared"
)

// Reports read the ledger (Phase 5 / W4, audit root cause RC1).
//
// Financial statements always read journal_entries while dashboards and
// reports recomputed the same money from operational tables, so the two
// disagreed with no signal that they had. The money-position figures now
// come from the ledger, and the operational computation is kept as a
// cross-check: when the two differ by more than a cent-ish epsilon the
// difference is reported as a consistency warning instead of one number
// silently winning.
//
// Volume analytics (sales by product/category/cashier, per-entity customer
// and supplier rows) stay operational -- they describe activity, not ledger
// positions. The financial trend moved to the ledger in Phase 6 / W2; the
// sales trends did not.

// ledgerDriftEpsilon absorbs per-line rounding between two independent
// summations of the same money; anything larger is real drift.
const ledgerDriftEpsilon = 0.05

type ledgerDriftCheck struct {
	Metric      string
	Ledger      float64
	Operational float64
}

// ledgerDriftWarnings reports every metric where the ledger and the
// operational tables disagree. An empty result means the two agree.
//
// The filter is a required argument, not an option, so that every one of the
// call sites has to decide what it is comparing. There are five of them, and a
// fix applied to one call site while the others kept the bug is the most
// repeated failure of this audit. Making the compiler demand the filter is the
// only guard that cannot be skipped.
//
// When the filter narrows by something the ledger cannot see, the two sides are
// answering different questions and there is nothing to compare.
func ledgerDriftWarnings(filter *shared.ResolvedFilter, checks []ledgerDriftCheck) []ReportConsistencyWarning {
	warnings := make([]ReportConsistencyWarning, 0)
	if filter.NarrowsBeyondLedgerScope() {
		return warnings
	}
	for _, check := range checks {
		difference := check.Ledger - check.Operational
		if math.Abs(difference) <= ledgerDriftEpsilon {
			continue
		}
		warnings = append(warnings, ReportConsistencyWarning{
			Code: "operational_ledger_drift_" + check.Metric,
			Message: fmt.Sprintf(
				"%s differs between the ledger (%.2f) and the operational tables (%.2f); difference %.2f. Run the accounting backfill or check for missing journals.",
				check.Metric, check.Ledger, check.Operational, difference,
			),
			SourceType: check.Metric,
		})
	}
	return warnings
}
