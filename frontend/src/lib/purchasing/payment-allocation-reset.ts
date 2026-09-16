/**
 * When a payment form may discard the bill allocations it is holding.
 *
 * Switching supplier must clear them: they name another supplier's bills. But
 * the same "supplier changed" effect also ran when the form OPENED for editing,
 * because opening sets the supplier and prefills the allocations in one update.
 * The prefill ran first, the clear ran second, and the allocations were gone
 * before anyone saw the form.
 *
 * Measured on production on 2026-09-16, editing the 540.00 payment that settled
 * QAF-INV-1001: the Bills tab showed 0.00 against that bill and the summary read
 * "AED 540.00 will be saved as supplier advance." Saving an edit as small as a
 * reference number would have unpaid a settled bill, reopened the payable and
 * booked the money as an advance the supplier never received as one.
 *
 * So the clear follows the supplier the allocations BELONG to, not the fact that
 * the selected supplier was assigned.
 *
 * Regression: ISSUE-031 — editing a payment silently turned a settled bill into an advance
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 */

/**
 * @param heldFor the supplier the current allocations were entered for, or null
 *   when the form has not prefilled or tracked any yet
 * @param selectedSupplierId the supplier now chosen in the form
 */
export function shouldDiscardAllocations(
  heldFor: string | null,
  selectedSupplierId: string,
): boolean {
  if (heldFor === null) {
    // Nothing is being held: an opening form, or one that never had a supplier.
    return false;
  }
  return heldFor !== selectedSupplierId;
}
