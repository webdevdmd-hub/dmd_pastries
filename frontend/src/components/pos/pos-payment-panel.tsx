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
  // Open store-credit balance of the selected customer (0 when no customer
  // is selected). Gates the store-credit tender and caps its amount.
  customerCreditBalance: number;
  error: Error | null;
  hasCustomer: boolean;
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
  customerCreditBalance,
  error,
  hasCustomer,
  isLoading,
  methods,
  onPaymentsChange,
  payments,
  total,
}: POSPaymentPanelProps): JSX.Element {
  const activeMethods = methods.filter(
    (method) =>
      method.status === "active" &&
      method.showInPos &&
      // The store-credit tender only exists for a selected customer with an
      // open balance; the server re-validates and locks the balance.
      (method.methodType !== "store_credit" || (hasCustomer && customerCreditBalance > 0)),
  );
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

    let amount = payments.length === 0 ? total : balanceDue;
    if (method.methodType === "store_credit") {
      amount = roundMoney(Math.min(amount, customerCreditBalance));
    }
    const nextPayment: PaymentInput = {
      paymentMethodId: method.id,
      paymentMethodName: method.methodName,
      amount,
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
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-foreground-muted">
          Payment
        </p>
        <p className="font-mono font-bold text-foreground">{formatMoney(balanceDue)}</p>
      </div>
      {isLoading ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-[0.7rem] text-foreground-muted">
          Loading POS payment methods...
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-[0.7rem] font-semibold text-danger-text">
          {errorMessage}
        </p>
      ) : null}
      {!isLoading && !errorMessage && activeMethods.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted px-3 py-2 text-[0.7rem] text-foreground-muted">
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
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-[0.7rem] text-foreground-muted">
          Active POS payment methods need linked default payment accounts before they can be used.
        </p>
      ) : null}
      {paymentRows.length > 0 ? (
        <div className="space-y-2">
          {paymentRows.map((payment) => (
            <div
              className="rounded-md border border-border bg-muted p-2"
              key={payment.paymentMethodId}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{payment.paymentMethodName}</p>
                <Button
                  aria-label={`Remove ${payment.paymentMethodName} payment`}
                  className="h-7 w-7 text-foreground-muted"
                  onClick={() => removePayment(payment.paymentMethodId)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <POSNumberInput
                className="h-9 rounded-md border-border bg-card font-mono shadow-none focus-visible:ring-black"
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
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                    Reference number required
                  </p>
                  <Input
                    className="h-9 rounded-md border-border bg-card font-mono shadow-none focus-visible:ring-black"
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
        <p className="rounded-md border border-dashed border-border bg-muted px-3 py-2 text-[0.7rem] text-foreground-muted">
          Select a payment method to start. Add another method for split payments.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 text-[0.7rem]">
        <div>
          <p className="text-foreground-muted">Paid</p>
          <p className="font-mono font-bold text-foreground">{formatMoney(paidAmount)}</p>
        </div>
        <div>
          <p className="text-foreground-muted">Balance</p>
          <p className="font-mono font-bold text-foreground">{formatMoney(balanceDue)}</p>
        </div>
        <div>
          <p className="text-foreground-muted">Change</p>
          <p className="font-mono font-bold text-foreground">{formatMoney(changeAmount)}</p>
        </div>
      </div>
    </div>
  );
}
