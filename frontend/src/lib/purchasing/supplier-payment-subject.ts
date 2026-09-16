import type { SupplierPayment } from "@/types/purchasing";

/** What the payment parser stores when a payment names no bill. Not a bill number. */
export const SUPPLIER_PAYMENT_WITHOUT_BILL = "Supplier payment";

/**
 * What a supplier payment paid for, in words for a confirmation.
 *
 * The delete confirmation read "...payment to {supplier} on invoice
 * {invoiceNumber}". A pure advance has no bill, so invoiceNumber carries the
 * parser's placeholder, and on production on 2026-09-16 deleting a 100.00
 * advance asked to confirm deleting the payment "on invoice Supplier payment"
 * -- a bill that does not exist, at the one step that cannot be undone. A
 * payment across several bills named only one of them.
 *
 * The amounts decide, as they do in the payment drawer: nothing allocated is an
 * advance; something allocated names the bill when there is one to name.
 *
 * Regression: ISSUE-034 — deleting an advance confirmed a payment "on invoice Supplier payment"
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 */
export function supplierPaymentSubject(
  payment: Pick<SupplierPayment, "allocatedAmount" | "invoiceNumber" | "unappliedAmount">,
): string {
  if (payment.allocatedAmount <= 0) {
    return "held as supplier advance";
  }

  const billNumber = payment.invoiceNumber.trim();
  const settled =
    billNumber && billNumber !== SUPPLIER_PAYMENT_WITHOUT_BILL
      ? `against bill ${billNumber}`
      : "against supplier bills";

  return payment.unappliedAmount > 0 ? `${settled}, part held as supplier advance` : settled;
}
