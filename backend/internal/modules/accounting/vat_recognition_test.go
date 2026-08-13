package accounting

import (
	"math"
	"testing"
)

// W2 acceptance #1: an inclusive AED 105 order with tax 5 — a 50% deposit
// recognizes 2.50, and a series of uneven payments reaching full payment
// recognizes exactly 5.00 lifetime (the remainder rule falls out of the
// cumulative formula).
func TestBakeryPaymentVATSlice(t *testing.T) {
	// 50% deposit on 105/5.
	if slice := bakeryPaymentVATSlice(5, 105, 52.5, 0); slice != 2.5 {
		t.Fatalf("50%% deposit slice = %v, want 2.5", slice)
	}

	// Three uneven payments: cumulative recognition must equal the order tax.
	payments := []float64{34.99, 34.99, 35.02}
	paid, recognized := 0.0, 0.0
	for _, payment := range payments {
		paid = math.Round((paid+payment)*100) / 100
		slice := bakeryPaymentVATSlice(5, 105, paid, recognized)
		recognized = math.Round((recognized+slice)*100) / 100
	}
	if recognized != 5 {
		t.Fatalf("cumulative recognized VAT = %v, want exactly 5", recognized)
	}

	// Legacy catch-up: deposits predate W2 (recognized 0, paid 60 already);
	// the next payment recognizes its own slice plus the catch-up.
	if slice := bakeryPaymentVATSlice(5, 105, 80, 0); slice != 3.81 {
		t.Fatalf("catch-up slice = %v, want 3.81", slice)
	}

	// No-tax orders never slice.
	if slice := bakeryPaymentVATSlice(0, 105, 50, 0); slice != 0 {
		t.Fatalf("no-tax slice = %v, want 0", slice)
	}

	// Overpayment clamps at the order tax.
	if slice := bakeryPaymentVATSlice(5, 105, 200, 0); slice != 5 {
		t.Fatalf("overpaid slice = %v, want 5", slice)
	}
}

// W2 acceptance #3: refunding a deposit before completion reverses its exact
// slices, returning 2100 and 2200 to their pre-deposit balances.
func TestBakeryRefundVATSliceBack(t *testing.T) {
	// Full refund of a 52.50 deposit that recognized 2.50.
	if slice := bakeryRefundVATSliceBack(5, 105, 0, 2.5, 52.5); slice != 2.5 {
		t.Fatalf("full-deposit refund slice back = %v, want 2.5", slice)
	}

	// Partial refund drops recognition to the new cumulative target.
	if slice := bakeryRefundVATSliceBack(5, 105, 21, 2.5, 31.5); slice != 1.5 {
		t.Fatalf("partial refund slice back = %v, want 1.5", slice)
	}

	// Nothing recognized → nothing to reverse.
	if slice := bakeryRefundVATSliceBack(5, 105, 10, 0, 20); slice != 0 {
		t.Fatalf("unrecognized refund slice back = %v, want 0", slice)
	}

	// The slice back never exceeds the refund itself.
	if slice := bakeryRefundVATSliceBack(100, 105, 0, 100, 5); slice != 5 {
		t.Fatalf("bounded slice back = %v, want 5", slice)
	}
}
