import { X } from "lucide-react";
import type { JSX } from "react";

import { POSPaymentMethodButton } from "@/components/pos/pos-payment-method-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentInput } from "@/types/pos";
import type { PaymentMethod } from "@/types/settings";

type POSPaymentPanelProps = {
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

export function POSPaymentPanel({
  methods,
  onPaymentsChange,
  payments,
  total,
}: POSPaymentPanelProps): JSX.Element {
  const activeMethods = methods.filter((method) => method.status === "active");
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
    <div className="space-y-2 rounded-[1.25rem] border border-brand-cappuccino/70 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-mocha">
          Payment
        </p>
        <p className="font-bold text-brand-espresso">{formatMoney(balanceDue)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {activeMethods.map((method) => (
          <POSPaymentMethodButton
            key={method.id}
            method={method}
            onSelect={addOrReplacePayment}
            selected={payments.some((payment) => payment.paymentMethodId === method.id)}
          />
        ))}
      </div>
      {paymentRows.length > 0 ? (
        <div className="space-y-2">
          {paymentRows.map((payment) => (
            <div
              className="rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/45 p-2"
              key={payment.paymentMethodId}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-brand-espresso">{payment.paymentMethodName}</p>
                <Button
                  aria-label={`Remove ${payment.paymentMethodName} payment`}
                  className="h-7 w-7 text-brand-mocha"
                  onClick={() => removePayment(payment.paymentMethodId)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                className="h-9 rounded-2xl border-brand-cappuccino bg-white"
                min={0}
                onChange={(event) =>
                  updatePayment(payment.paymentMethodId, {
                    amount: Number(event.target.value),
                  })
                }
                placeholder="Paid amount"
                step="0.01"
                type="number"
                value={String(payment.amount)}
              />
              {payment.requiresReference ? (
                <div className="mt-2 space-y-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-brand-mocha">
                    Reference number required
                  </p>
                  <Input
                    className="h-9 rounded-2xl border-brand-cappuccino bg-white"
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
        <p className="rounded-2xl border border-dashed border-brand-cappuccino/70 bg-brand-latte/40 px-3 py-2 text-[0.7rem] text-brand-mocha">
          Select a payment method to start. Add another method for split payments.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 text-[0.7rem]">
        <div>
          <p className="text-brand-mocha">Paid</p>
          <p className="font-bold text-brand-espresso">{formatMoney(paidAmount)}</p>
        </div>
        <div>
          <p className="text-brand-mocha">Balance</p>
          <p className="font-bold text-brand-espresso">{formatMoney(balanceDue)}</p>
        </div>
        <div>
          <p className="text-brand-mocha">Change</p>
          <p className="font-bold text-brand-espresso">{formatMoney(changeAmount)}</p>
        </div>
      </div>
    </div>
  );
}
