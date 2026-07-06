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
