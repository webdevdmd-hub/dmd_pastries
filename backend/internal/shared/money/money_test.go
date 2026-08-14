package money

import (
	"math"
	"testing"
)

// Adopting this package must not move a single figure, so these pin the
// behaviour the eighteen per-package copies had: math.Round, which is
// half-away-from-zero.
func TestRound2MatchesThePreviousPerPackageBehaviour(t *testing.T) {
	for _, value := range []float64{
		0, 1, -1, 0.005, -0.005, 2.675, 1234.5649, 1234.5651,
		-1234.5649, 0.1 + 0.2, 999999.994, 999999.995,
	} {
		if got, want := Round2(value), math.Round(value*100)/100; got != want {
			t.Fatalf("Round2(%v) = %v, previously %v", value, got, want)
		}
	}
}

func TestRound4MatchesThePreviousPerPackageBehaviour(t *testing.T) {
	for _, value := range []float64{
		0, 1, -1, 0.00005, 0.12345, -0.12345, 1.000049, 1.000051,
	} {
		if got, want := Round4(value), math.Round(value*10000)/10000; got != want {
			t.Fatalf("Round4(%v) = %v, previously %v", value, got, want)
		}
	}
}

func TestRoundingIsHalfAwayFromZero(t *testing.T) {
	if got := Round2(2.345); got != 2.35 {
		t.Fatalf("Round2(2.345) = %v, want 2.35", got)
	}
	if got := Round2(-2.345); got != -2.35 {
		t.Fatalf("Round2(-2.345) = %v, want -2.35", got)
	}
}

// Round4 is the scale for quantities and unit costs. Collapsing it to cents
// would compound error through weighted-average costing, which feeds each
// computed unit cost back in as the next movement's basis.
func TestRound4KeepsSubCentUnitCosts(t *testing.T) {
	if got := Round4(0.0125); got != 0.0125 {
		t.Fatalf("Round4(0.0125) = %v, want 0.0125", got)
	}
	if Round2(0.0125) == Round4(0.0125) {
		t.Fatal("Round2 and Round4 must not be interchangeable for unit costs")
	}
}

func TestEqualToleratesSubCentNoiseButNotRealDifferences(t *testing.T) {
	// The same money reached by two different summation orders.
	if !Equal(1234.56, 1234.5600000001) {
		t.Fatal("sub-cent float noise must not read as a discrepancy")
	}
	if !Equal(0.1+0.2, 0.3) {
		t.Fatal("0.1+0.2 must compare equal to 0.3")
	}
	// A cent is a real difference.
	if Equal(1234.56, 1234.57) {
		t.Fatal("a one-cent difference is real and must not be tolerated")
	}
}

func TestAbsReturnsMagnitude(t *testing.T) {
	if Abs(-5.25) != 5.25 || Abs(5.25) != 5.25 {
		t.Fatal("Abs must return the magnitude")
	}
}
