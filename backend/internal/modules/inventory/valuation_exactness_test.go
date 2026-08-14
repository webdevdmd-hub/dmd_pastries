package inventory

import (
	"testing"

	"pastries-pos/internal/shared/money"
)

// Weighted-average costing is the one place in the codebase where a rounded
// result feeds back in as the basis for the next computation: each movement's
// average cost becomes the next movement's cost basis. With float64 the error
// did not stay put, it compounded across the series. These tests pin the
// behaviour that removes it (Phase 6 / W4).

func amount(t *testing.T, text string) money.Amount {
	t.Helper()
	value, err := money.FromString(text)
	if err != nil {
		t.Fatalf("parse %q: %v", text, err)
	}
	return value
}

// Receiving stock at a price that does not divide evenly is where the
// compounding starts. Value and quantity must stay consistent with the
// average carried forward.
func TestInboundValuationKeepsValueAndAverageConsistent(t *testing.T) {
	// 3 units at 10.00, then 3 more at 20.00 -> 6 units worth 90.00, average 15.
	unitCost, totalCost, averageCost, afterValue := calculateValuation(
		"in", money.Zero, money.Zero, money.Zero, amount(t, "3"), amount(t, "10.00"))
	if !totalCost.Equal(amount(t, "30.00")) {
		t.Fatalf("first receipt total cost = %s, want 30.00", totalCost)
	}
	if !averageCost.Equal(amount(t, "10")) {
		t.Fatalf("first receipt average = %s, want 10", averageCost)
	}
	if !unitCost.Equal(amount(t, "10")) {
		t.Fatalf("unit cost = %s, want 10", unitCost)
	}

	_, _, averageCost, afterValue = calculateValuation(
		"in", amount(t, "3"), afterValue, averageCost, amount(t, "3"), amount(t, "20.00"))
	if !afterValue.Equal(amount(t, "90.00")) {
		t.Fatalf("value after second receipt = %s, want 90.00", afterValue)
	}
	if !averageCost.Equal(amount(t, "15")) {
		t.Fatalf("average after second receipt = %s, want 15", averageCost)
	}
}

// A price that cannot be represented in binary floating point, received
// repeatedly. The average must stay exactly the unit cost rather than drifting.
func TestRepeatedReceiptsAtAnAwkwardPriceDoNotDrift(t *testing.T) {
	unitPrice := amount(t, "0.07")
	quantity, value, average := money.Zero, money.Zero, money.Zero

	for range 50 {
		_, _, nextAverage, nextValue := calculateValuation("in", quantity, value, average, amount(t, "1"), unitPrice)
		quantity = quantity.Add(amount(t, "1"))
		value, average = nextValue, nextAverage
	}

	if !quantity.Equal(amount(t, "50")) {
		t.Fatalf("quantity = %s, want 50", quantity)
	}
	// 50 x 0.07 is exactly 3.50, and the average is exactly the price paid.
	if !value.Equal(amount(t, "3.50")) {
		t.Fatalf("value after 50 receipts at 0.07 = %s, want 3.50", value)
	}
	if !average.Equal(unitPrice) {
		t.Fatalf("average = %s, want %s -- the cost basis has drifted", average, unitPrice)
	}
}

// Issuing stock reduces value by the cost of what left and leaves the average
// alone; emptying the item clears the average so the next receipt sets it.
func TestOutboundValuationLeavesTheAverageAloneUntilEmpty(t *testing.T) {
	_, totalCost, averageCost, afterValue := calculateValuation(
		"out", amount(t, "10"), amount(t, "150.00"), amount(t, "15.00"), amount(t, "4"), money.Zero)

	if !totalCost.Equal(amount(t, "60.00")) {
		t.Fatalf("issue cost = %s, want 60.00", totalCost)
	}
	if !afterValue.Equal(amount(t, "90.00")) {
		t.Fatalf("value after issue = %s, want 90.00", afterValue)
	}
	if !averageCost.Equal(amount(t, "15.00")) {
		t.Fatalf("average must not move on an issue, got %s", averageCost)
	}

	_, _, emptiedAverage, emptiedValue := calculateValuation(
		"out", amount(t, "6"), amount(t, "90.00"), amount(t, "15.00"), amount(t, "6"), money.Zero)
	if !emptiedAverage.IsZero() {
		t.Fatalf("average should clear when the item empties, got %s", emptiedAverage)
	}
	if !emptiedValue.IsZero() {
		t.Fatalf("value should clear when the item empties, got %s", emptiedValue)
	}
}

// Value can never go negative, whatever the cost basis says.
func TestOutboundValuationClampsValueAtZero(t *testing.T) {
	_, _, _, afterValue := calculateValuation(
		"out", amount(t, "1"), amount(t, "5.00"), amount(t, "50.00"), amount(t, "1"), amount(t, "50.00"))
	if afterValue.IsNegative() {
		t.Fatalf("inventory value must not go negative, got %s", afterValue)
	}
	if !afterValue.IsZero() {
		t.Fatalf("value = %s, want 0", afterValue)
	}
}

// Unit costs are kept at four decimals because they are stored in
// NUMERIC(12,4) and feed the next movement. Rounding them to cents would lose
// precision on every receipt.
func TestUnitCostKeepsFourDecimals(t *testing.T) {
	// 1000 units for 1.00 is 0.001 each.
	_, _, averageCost, _ := calculateValuation(
		"in", money.Zero, money.Zero, money.Zero, amount(t, "1000"), amount(t, "0.001"))
	if !averageCost.Equal(amount(t, "0.001")) {
		t.Fatalf("average = %s, want 0.001 kept at four decimals", averageCost)
	}
}
