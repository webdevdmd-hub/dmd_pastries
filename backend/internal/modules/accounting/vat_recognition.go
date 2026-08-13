package accounting

// Phase 4 / W2 — VAT recognition on each bakery payment.
//
// A deposit carries its proportional VAT slice immediately; completion
// recognizes only the remainder. Slices use the cumulative-rounding rule:
// the recognized total after any event is round(tax * paid/total), and each
// slice is the difference from what was recognized before. That makes the
// series exact — when the order is fully paid the recognized total equals
// the order's tax to the cent — and lets legacy orders (deposits taken
// before W2 with nothing recognized) catch up on their next payment.

import "math"

// bakeryPaymentVATSlice returns the VAT slice a payment recognizes:
// the cumulative target at paidAfter minus what is already recognized.
func bakeryPaymentVATSlice(taxTotal, totalAmount, paidAfter, recognizedBefore float64) float64 {
	if taxTotal <= 0 || totalAmount <= 0 {
		return 0
	}
	ratio := math.Min(paidAfter/totalAmount, 1)
	cumulative := roundMoney(taxTotal * ratio)
	slice := roundMoney(cumulative - recognizedBefore)
	if slice < 0 {
		return 0
	}
	if slice > taxTotal {
		return taxTotal
	}
	return slice
}

// bakeryRefundVATSliceBack returns the VAT slice an advance refund reverses:
// recognized drops back to the cumulative target at the reduced paid amount.
// Bounded by the refund itself so the journal's net advance debit stays >= 0.
func bakeryRefundVATSliceBack(taxTotal, totalAmount, paidAfterRefund, recognizedBefore, refundAmount float64) float64 {
	if taxTotal <= 0 || totalAmount <= 0 || recognizedBefore <= 0 {
		return 0
	}
	if paidAfterRefund < 0 {
		paidAfterRefund = 0
	}
	target := roundMoney(taxTotal * math.Min(paidAfterRefund/totalAmount, 1))
	sliceBack := roundMoney(recognizedBefore - target)
	if sliceBack < 0 {
		return 0
	}
	if sliceBack > refundAmount {
		sliceBack = roundMoney(refundAmount)
	}
	return sliceBack
}
