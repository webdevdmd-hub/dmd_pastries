// Package money holds the arithmetic every module uses to keep amounts at a
// sane scale.
//
// It exists because the same three-line rounding helper had been copied into
// eighteen packages (plus five differently-named variants), all byte-identical
// and none of them able to change without the others silently disagreeing.
//
// It is also the seam for the float64 -> decimal migration (Phase 6 / W4).
// Amounts are float64 today against NUMERIC(14,4) operational and
// NUMERIC(14,2) ledger columns, which is why a rounding-residue absorber, a
// drift epsilon, and a scatter of inline tolerance literals exist at all.
// Routing every module through this package first means the type swap changes
// this file and the struct fields, rather than ~934 call sites spread over 94
// files.
//
// The implementations here reproduce the previous per-package behaviour
// exactly -- math.Round is half-away-from-zero, as is decimal.Round -- so
// adopting the package changes no figure anywhere.
package money

import "math"

// Epsilon is the sub-cent tolerance for deciding whether two independently
// summed amounts are the same money. Rounding each line of a document
// separately and then totalling it does not always land on the same float as
// totalling first, and that difference is noise rather than a discrepancy.
//
// Once amounts are decimals this becomes unnecessary: the comparison is
// exact, and any remaining difference is real.
const Epsilon = 0.005

// Round2 snaps an amount to cents, the scale money is presented and posted at.
func Round2(value float64) float64 {
	return math.Round(value*100) / 100
}

// Round4 snaps a value to four decimals: the scale used for quantities (a
// recipe can call for 0.0125 kg) and for unit costs, which are stored in
// NUMERIC(12,4) columns.
//
// A per-unit cost is money, but it is deliberately kept at four decimals
// rather than two. Weighted-average costing feeds each computed unit cost
// back in as the basis for the next movement, so rounding it to cents would
// compound error across a movement series instead of containing it.
func Round4(value float64) float64 {
	return math.Round(value*10000) / 10000
}

// Abs returns the magnitude of an amount. Journal lines carry their direction
// in the debit/credit column rather than the sign, so postings need this.
func Abs(value float64) float64 {
	return math.Abs(value)
}

// Equal reports whether two amounts represent the same money, tolerating
// sub-cent float noise.
//
// Use this instead of ==/!= on amounts. An exact comparison between a rounded
// figure and an unrounded one rejects values that are the same money, which
// is a user-facing failure rather than a rounding curiosity.
func Equal(left, right float64) bool {
	return math.Abs(Round2(left)-Round2(right)) < Epsilon
}
