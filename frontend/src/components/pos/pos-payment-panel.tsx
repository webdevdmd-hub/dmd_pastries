import { X } from "lucide-react";
import type { JSX } from "react";

import { POSNumberInput } from "@/components/pos/pos-number-input";
import { POSPaymentMethodButton } from "@/components/pos/pos-payment-method-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { PaymentInput } from "@/types/pos";
import type { PaymentMethod } from "@/types/settings";

type POSPaymentPanelProps = {
  error: Error | null;
  isLoading: boolean;
  methods: PaymentMethod[];
  onPaymentsChange: (payments: PaymentInput[]) => void;
  payments: PaymentInput[];
  total: number;
};

type PaymentRow = PaymentInput & {
  requiresReference: boolean;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getPaymentMethodsErrorMessage(error: Error | null): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError && error.status === 403) {
    return "Cashier role cannot load POS payment methods. Add pos/payment method view permission.";
  }

  return getErrorMessage(error);
}

export function POSPaymentPanel({
  error,
  isLoading,
  methods,
  onPaymentsChange,
  payments,
  total,
}: POSPaymentPanelProps): JSX.Element {
  const activeMethods = methods.filter((method) => method.status === "active" && method.showInPos);
  const unavailableMethods = activeMethods.filter((method) => !method.defaultPaymentAccountId);
  const errorMessage = getPaymentMethodsErrorMessage(error);
  const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const balanceDue = roundMoney(Math.max(total - paidAmount, 0));
  const changeAmount = roundMoney(Math.max(paidAmount - total, 0));
  const paymentRows: PaymentRow[] = payments.map((payment) => {
    const method = activeMethods.find((entry) => entry.id === payment.paymentMethodId);

    return {
      ...payment,
      requiresReference: method?.requiresReference ?? false,
    };
  });

  const addOrReplacePayment = (method: PaymentMethod): void => {
    if (!method.defaultPaymentAccountId) {
      return;
    }

    const existingPayment = payments.find((payment) => payment.paymentMethodId === method.id);

    if (existingPayment) {
      return;
    }

    const nextPayment: PaymentInput = {
      paymentMethodId: method.id,
      paymentMethodName: method.methodName,
      amount: payments.length === 0 ? total : balanceDue,
      referenceNumber: null,
    };

    if (payments.length === 0 || !method.allowSplitPayment) {
      onPaymentsChange([nextPayment]);
      return;
    }

    onPaymentsChange([...payments, nextPayment]);
  };

  const updatePayment = (paymentMethodId: string, patch: Partial<PaymentInput>): void => {
    onPaymentsChange(
      payments.map((payment) =>
        payment.paymentMethodId === paymentMethodId ? { ...payment, ...patch } : payment,
      ),
    );
  };

  const removePayment = (paymentMethodId: string): void => {
    onPaymentsChange(payments.filter((payment) => payment.paymentMethodId !== paymentMethodId));
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-300 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-zinc-500">
          Payment
        </p>
        <p className="font-mono font-bold text-zinc-950">{formatMoney(balanceDue)}</p>
      </div>
      {isLoading ? (
        <p className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-[0.7rem] text-zinc-600">
          Loading POS payment methods...
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {!isLoading && !errorMessage && activeMethods.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-400 bg-zinc-50 px-3 py-2 text-[0.7rem] text-zinc-600">
          No POS payment methods are available for this branch.
        </p>
      ) : null}
      {activeMethods.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {activeMethods.map((method) => (
            <POSPaymentMethodButton
              key={method.id}
              disabled={!method.defaultPaymentAccountId}
              method={method}
              onSelect={addOrReplacePayment}
              selected={payments.some((payment) => payment.paymentMethodId === method.id)}
            />
          ))}
        </div>
      ) : null}
      {unavailableMethods.length > 0 ? (
        <p className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-[0.7rem] text-zinc-600">
          Active POS payment methods need linked default payment accounts before they can be used.
        </p>
      ) : null}
      {paymentRows.length > 0 ? (
        <div className="space-y-2">
          {paymentRows.map((payment) => (
            <div
              className="rounded-md border border-zinc-300 bg-zinc-50 p-2"
              key={payment.paymentMethodId}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-zinc-950">{payment.paymentMethodName}</p>
                <Button
                  aria-label={`Remove ${payment.paymentMethodName} payment`}
                  className="h-7 w-7 text-zinc-600"
                  onClick={() => removePayment(payment.paymentMethodId)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <POSNumberInput
                className="h-9 rounded-md border-zinc-300 bg-white font-mono shadow-none focus-visible:ring-black"
                onValueChange={(amount) =>
                  updatePayment(payment.paymentMethodId, {
                    amount: amount ?? 0,
                  })
                }
                placeholder="Paid amount"
                value={payment.amount}
              />
              {payment.requiresReference ? (
                <div className="mt-2 space-y-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Reference number required
                  </p>
                  <Input
                    className="h-9 rounded-md border-zinc-300 bg-white font-mono shadow-none focus-visible:ring-black"
                    onChange={(event) =>
                      updatePayment(payment.paymentMethodId, {
                        referenceNumber: event.target.value,
                      })
                    }
                    placeholder="Card approval / transfer reference"
                    value={payment.referenceNumber ?? ""}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-zinc-400 bg-zinc-50 px-3 py-2 text-[0.7rem] text-zinc-600">
          Select a payment method to start. Add another method for split payments.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 text-[0.7rem]">
        <div>
          <p className="text-zinc-500">Paid</p>
          <p className="font-mono font-bold text-zinc-950">{formatMoney(paidAmount)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Balance</p>
          <p className="font-mono font-bold text-zinc-950">{formatMoney(balanceDue)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Change</p>
          <p className="font-mono font-bold text-zinc-950">{formatMoney(changeAmount)}</p>
        </div>
      </div>
    </div>
  );
}
