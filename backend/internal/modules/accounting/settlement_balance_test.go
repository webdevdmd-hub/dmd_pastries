package accounting

import (
	"os"
	"strings"
	"testing"

	"pastries-pos/internal/shared/money"
)

// A platform settlement is rejected unless net received plus deductions
// equals the gross payout. That check used to be an exact float comparison
// between a rounded left side and the raw request value on the right, with
// the deductions total itself built by rounding each line as it accumulated.
// Three different rounding paths meeting at != is a user-facing 400 on a
// settlement that balances to the cent.
func TestSettlementBalanceCheckIsNotAnExactFloatComparison(t *testing.T) {
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read accounting service source: %v", err)
	}
	text := string(source)

	if strings.Contains(text, "roundMoney(netReceived+deductionsTotal) != grossAmount") {
		t.Fatal("the settlement balance check must compare with a tolerance, not ==/!=")
	}
	if !strings.Contains(text, "money.Equal(netReceived+deductionsTotal, grossAmount)") {
		t.Fatal("the settlement balance check must use money.Equal")
	}
}

// The behaviour the fix depends on: sub-cent noise accepted, a real
// discrepancy still rejected.
func TestSettlementToleranceAcceptsNoiseAndRejectsRealGaps(t *testing.T) {
	grossAmount := 1234.56
	// Deductions accumulated one rounded line at a time.
	deductions := 0.0
	for _, line := range []float64{12.34, 5.67, 1.23} {
		deductions = money.Round2(deductions + line)
	}
	netReceived := grossAmount - deductions

	if !money.Equal(netReceived+deductions, grossAmount) {
		t.Fatal("a settlement that balances must be accepted")
	}
	if money.Equal(netReceived+deductions+0.01, grossAmount) {
		t.Fatal("a one-cent discrepancy must still be rejected")
	}
}
