package accounting

import (
	"regexp"
	"strings"
	"testing"
)

// An expense posted to 60 - Operating Expenses, a header account, produced a
// balanced journal that the trial balance had no row for: the bank credit
// showed, the expense debit did not, and the report announced
// "Debit / credit mismatch" for a ledger that was correct. The query excluded
// every header outright.
//
// A trial balance may not drop a balance -- proving the ledger balances is the
// one thing it exists to do. Headers still stay out when they are empty, which
// is the normal case, so the ordinary report is unchanged.
func TestTrialBalanceKeepsHeaderAccountsThatCarryABalance(t *testing.T) {
	source, err := readSourceFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	body := functionBody(source, "func (r *Repository) ListTrialBalanceRows(")
	if body == "" {
		t.Fatal("ListTrialBalanceRows not found")
	}

	if strings.Contains(body, "AND coa.is_header = false\n") {
		t.Error("headers are excluded unconditionally again; a balance on one would vanish " +
			"from the trial balance and the report would show a false mismatch")
	}

	// The header must be admitted only when it actually carries something,
	// otherwise the report fills with empty grouping rows.
	gate := regexp.MustCompile(`(?s)coa\.is_header = false\s*OR ABS\(COALESCE\(at\.opening_balance`)
	if !gate.MatchString(body) {
		t.Error("expected `is_header = false OR <non-zero balance>` so headers appear only when they carry a balance")
	}

	for _, column := range []string{"at.opening_balance", "at.period_debit", "at.period_credit"} {
		if !strings.Contains(body, "ABS(COALESCE("+column+", 0)) > 0.004") {
			t.Errorf("header gate ignores %s, so a balance held only in that column would still vanish", column)
		}
	}
}

// The zero-balance toggle must not drag every empty header into the report.
func TestTrialBalanceHeaderGateIsIndependentOfIncludeZeroBalances(t *testing.T) {
	source, err := readSourceFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	body := functionBody(source, "func (r *Repository) ListTrialBalanceRows(")

	headerGate := strings.Index(body, "coa.is_header = false")
	zeroGate := strings.Index(body, "AND (? = true OR ABS(")
	if headerGate == -1 || zeroGate == -1 {
		t.Fatal("could not locate both gates")
	}
	if headerGate > zeroGate {
		t.Error("the header gate must be its own clause ahead of the include_zero_balances clause, " +
			"not folded into it, or ticking Include zero balances lists every empty header")
	}
}
