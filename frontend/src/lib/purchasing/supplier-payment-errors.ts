import { ApiError, getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function supplierPaymentErrorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.errorDetails?.reason === "insufficient_payment_account_balance"
  ) {
    const availableBalance =
      typeof error.errorDetails.available_balance === "number"
        ? error.errorDetails.available_balance
        : null;
    const paymentAmount =
      typeof error.errorDetails.payment_amount === "number"
        ? error.errorDetails.payment_amount
        : null;

    if (availableBalance !== null && paymentAmount !== null) {
      return `Insufficient balance in selected payment account. Available balance is ${formatCurrency(
        availableBalance,
      )}, payment amount is ${formatCurrency(paymentAmount)}.`;
    }
  }

  return getErrorMessage(error);
}
