import type { CartTotals, PaymentInput } from "@/types/pos";
import type { PaymentMethod, SalesChannel } from "@/types/settings";

export type CheckoutFeedback = {
  message: string;
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

  if (payments.length === 0) {
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

  const invalidPayment = payments.find(
    (payment) => !Number.isFinite(payment.amount) || payment.amount <= 0,
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
