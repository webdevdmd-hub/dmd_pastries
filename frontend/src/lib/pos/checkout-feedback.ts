import type { CartTotals, PaymentInput } from "@/types/pos";
import type { PaymentMethod, SalesChannel } from "@/types/settings";

/**
 * Money comparisons round to the fils, so "zero" means "under half a fils".
 * Matches the tolerance the overpayment check below already uses and the
 * 0.0001 the backend uses when comparing paid against total.
 */
export const ZERO_TOTAL_EPSILON = 0.0001;

export type CheckoutFeedback = {
  message: string;
  // Only set for the "checkout status unknown" state: the request itself
  // failed AND the follow-up verify call also failed, so we genuinely don't
  // know whether the sale landed. Retrying is safe (same checkoutReference),
  // but the cashier needs an explicit action rather than having to guess that
  // pressing Confirm again is the right move.
  showRetry?: boolean;
  title: string;
  tone: "error" | "info" | "success" | "warning";
};

export type CheckoutBlocker = {
  buttonLabel: string;
  feedback: CheckoutFeedback;
};

type ResolveCheckoutBlockerInput = {
  branchId: string;
  externalOrderNumber: string;
  itemCount: number;
  paymentMethods: PaymentMethod[];
  paymentMethodsError: Error | null;
  payments: PaymentInput[];
  salesChannelId: string;
  salesChannels: SalesChannel[];
  totals: CartTotals;
};

function errorBlocker(buttonLabel: string, message: string): CheckoutBlocker {
  return {
    buttonLabel,
    feedback: {
      message,
      title: "Checkout needs attention",
      tone: "error",
    },
  };
}

export function resolveCheckoutBlocker({
  branchId,
  externalOrderNumber,
  itemCount,
  paymentMethods,
  paymentMethodsError,
  payments,
  salesChannelId,
  salesChannels,
  totals,
}: ResolveCheckoutBlockerInput): CheckoutBlocker | null {
  if (!branchId) {
    return errorBlocker(
      "Select branch",
      "No active branch is selected. Switch to an active branch before checkout.",
    );
  }

  if (itemCount === 0) {
    return errorBlocker("Add items", "Add at least one item before confirming the sale.");
  }

  if (paymentMethodsError) {
    return errorBlocker(
      "Payment methods unavailable",
      "Payment methods could not be loaded. Retry payment setup or refresh this POS screen.",
    );
  }

  // A sale can legitimately come to nothing: a comp, a staff meal, a 100%-off
  // promotion. Nothing is owed, so there is nothing to tender, and demanding a
  // payment method here is unsatisfiable -- the amount that would settle it is
  // zero, which the "greater than zero" rule below then rejects. The cashier's
  // only way through was to record taking cash and handing the same cash back,
  // which writes a cash movement that never happened.
  //
  // The backend already expects this shape: Checkout only refuses an empty
  // payments list when TotalAmount > 0 (pos/service.go). submitCheckout drops
  // zero-amount tenders to match, because buildPayments rejects a zero line.
  //
  // Regression: ISSUE-001 — a zero-total sale could not be completed
  // Found by /qa on 2026-09-14
  const nothingDue = totals.total <= ZERO_TOTAL_EPSILON;

  if (payments.length === 0 && !nothingDue) {
    return errorBlocker("Select payment", "Select a payment method before confirming the sale.");
  }

  const selectablePaymentMethods = paymentMethods.filter(
    (method) => method.status === "active" && method.showInPos && method.defaultPaymentAccountId,
  );
  const selectablePaymentMethodIds = new Set(selectablePaymentMethods.map((method) => method.id));
  const unavailablePayment = payments.find(
    (payment) => !selectablePaymentMethodIds.has(payment.paymentMethodId),
  );

  if (unavailablePayment) {
    return errorBlocker(
      "Select valid payment",
      `${unavailablePayment.paymentMethodName} is not available for POS checkout. Select an active payment method with a linked payment account.`,
    );
  }

  // When nothing is due, a zero tender is the correct amount rather than an
  // error: the register auto-selects a method and fills 0, and submitCheckout
  // drops it. A negative or non-finite amount is still wrong either way.
  const invalidPayment = payments.find((payment) =>
    nothingDue
      ? !Number.isFinite(payment.amount) || payment.amount < 0
      : !Number.isFinite(payment.amount) || payment.amount <= 0,
  );

  if (invalidPayment) {
    return errorBlocker(
      "Fix amount",
      `${invalidPayment.paymentMethodName} payment amount must be greater than zero.`,
    );
  }

  const missingReferencePayment = payments.find((payment) => {
    const method = paymentMethods.find((entry) => entry.id === payment.paymentMethodId);
    return method?.requiresReference === true && !payment.referenceNumber?.trim();
  });

  if (missingReferencePayment) {
    return errorBlocker(
      "Reference required",
      `Reference number is required for ${missingReferencePayment.paymentMethodName}.`,
    );
  }

  const selectedSalesChannel =
    salesChannels.find((channel) => channel.id === salesChannelId) ?? null;

  if (
    selectedSalesChannel?.requiresExternalOrderNumber === true &&
    externalOrderNumber.trim().length === 0
  ) {
    return errorBlocker(
      "Order number required",
      `External order number is required for ${selectedSalesChannel.channelName}.`,
    );
  }

  const nonCashPaidAmount = payments.reduce((sum, payment) => {
    const method = paymentMethods.find((entry) => entry.id === payment.paymentMethodId);
    return method?.methodType === "cash" ? sum : sum + payment.amount;
  }, 0);
  const nonCashOverpayAmount = nonCashPaidAmount - totals.total;

  if (nonCashOverpayAmount > 0.0001) {
    return errorBlocker(
      "Fix overpayment",
      "Only cash payments can exceed the sale total for change. Reduce the non-cash payment amount or add cash for change.",
    );
  }

  return null;
}
