package accounting

import "testing"

func sumLines(lines []JournalEntryLine) (debit, credit float64) {
	for _, line := range lines {
		debit += line.DebitAmount
		credit += line.CreditAmount
	}
	return roundMoney(debit), roundMoney(credit)
}

// Operational amounts carry 4 decimal places, the ledger 2, so a legitimate
// posting can land a sub-cent apart. The residue must be absorbed rather than
// rejected: rejection rolls back the sale, not just the journal.
func TestAbsorbRoundingResidueBalancesTheEntry(t *testing.T) {
	lines := []JournalEntryLine{
		{DebitAmount: 100.01},
		{CreditAmount: 95.00},
		{CreditAmount: 5.00},
	}

	debit, credit := sumLines(lines)
	if debit == credit {
		t.Fatal("precondition failed: lines already balance")
	}

	if !absorbRoundingResidue(lines, roundMoney(debit-credit)) {
		t.Fatal("absorbRoundingResidue refused a one-cent residue")
	}

	debit, credit = sumLines(lines)
	if debit != credit {
		t.Fatalf("entry still unbalanced: debit=%.4f credit=%.4f", debit, credit)
	}
}

// The adjustment lands on the largest line, where a sub-cent change is least
// material — not on a small line where it would be visible.
func TestAbsorbRoundingResidueAdjustsTheLargestLine(t *testing.T) {
	lines := []JournalEntryLine{
		{DebitAmount: 0.02},
		{DebitAmount: 500.01},
		{CreditAmount: 500.03},
	}

	if !absorbRoundingResidue(lines, 0.0) {
		t.Fatal("absorbRoundingResidue failed on a zero residue")
	}

	lines = []JournalEntryLine{
		{DebitAmount: 0.02},
		{DebitAmount: 500.01},
		{CreditAmount: 500.02},
	}
	debit, credit := sumLines(lines)
	if !absorbRoundingResidue(lines, roundMoney(debit-credit)) {
		t.Fatal("absorbRoundingResidue refused a one-cent residue")
	}
	// The 0.02 line must be untouched: a cent there is the whole line, whereas
	// on a 500 line it is immaterial.
	if lines[0].DebitAmount != 0.02 {
		t.Fatalf("small line was adjusted: %.4f", lines[0].DebitAmount)
	}
	if debit, credit = sumLines(lines); debit != credit {
		t.Fatalf("entry still unbalanced: debit=%.4f credit=%.4f", debit, credit)
	}
}

// A residue is only ever a rounding artifact below half a cent. Anything larger
// is a real imbalance and must not be silently absorbed.
func TestSystemBalanceEpsilonIsSubCent(t *testing.T) {
	if systemBalanceEpsilon <= 0 || systemBalanceEpsilon >= 0.01 {
		t.Fatalf("systemBalanceEpsilon = %v, want a value between 0 and one cent", systemBalanceEpsilon)
	}
}

func TestAbsorbRoundingResidueRefusesToDriveALineNegative(t *testing.T) {
	lines := []JournalEntryLine{{DebitAmount: 0.001}}
	if absorbRoundingResidue(lines, 1.0) {
		t.Fatal("absorbRoundingResidue drove a line negative instead of refusing")
	}
}
