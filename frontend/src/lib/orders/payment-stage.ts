import type { OrderPaymentType } from "@/types/orders";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveOrderPaymentType({
  balanceAmount,
  paidAmount,
  paymentAmount,
}: {
  balanceAmount: number;
  paidAmount: number;
  paymentAmount: number;
}): OrderPaymentType {
  const roundedBalance = roundMoney(balanceAmount);
  const roundedPaid = roundMoney(paidAmount);
  const roundedPayment = roundMoney(Number.isFinite(paymentAmount) ? paymentAmount : 0);

  if (roundedPayment >= roundedBalance) {
    return "full";
  }

  if (roundedPaid <= 0) {
    return "deposit";
  }

  return "balance";
}

export function orderPaymentTypeLabel(paymentType: OrderPaymentType | null | undefined): string {
  if (paymentType === "deposit") {
    return "Deposit / Advance Payment";
  }

  if (paymentType === "full") {
    return "Final Settlement Payment";
  }

  if (paymentType === "balance") {
    return "Balance Payment";
  }

  return "Not set";
}

/**
 * The stage label for a payment on the Payments screens, where the row may be a
 * bakery order payment OR a counter sale.
 *
 * A POS sale settles in one go and has no deposit/balance/final stage, so
 * orderPaymentTypeLabel's fallback of "Not set" reads as a data gap on every
 * counter sale rather than as "this concept does not apply here".
 *
 * That was fixed once, inside payments-table, and the card grid and the details
 * drawer kept calling orderPaymentTypeLabel directly -- so the bug stayed live
 * in the view the page actually renders by default. Fixing it at one call site
 * is what let it survive, so the rule lives here now and every view asks for it.
 *
 * Regression: ISSUE-014 — "Not set" stage on counter sales, in the views the first fix missed
 * Found by /qa on 2026-09-15
 */
export function paymentStageLabel(
  paymentType: OrderPaymentType | null | undefined,
  sourceType: string,
): string {
  if (paymentType) {
    return orderPaymentTypeLabel(paymentType);
  }

  // A bakery order payment genuinely should carry a stage, so its absence there
  // IS a gap worth showing. A sale payment never has one.
  return sourceType === "bakery_order" ? "Not set" : "Sale payment";
}
