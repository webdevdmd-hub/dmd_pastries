"use client";

import { X } from "lucide-react";
import type { JSX } from "react";
import { useRef, useState } from "react";

import { useConfirm } from "@/components/app/confirm-provider";
import { POSNumberInput } from "@/components/pos/pos-number-input";
import { POSPaymentMethodButton } from "@/components/pos/pos-payment-method-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { CartTotals, PaymentInput } from "@/types/pos";
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
  // Sourced from `cart.totals` so this panel and the checkout summary card
  // below it read the same Paid / Balance / Change numbers (P-11) instead of
  // each re-deriving them from `payments`.
  totals: CartTotals;
};

type PaymentRow = PaymentInput & {
  methodType: string;
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

function roundUpTo(value: number, step: number): number {
  return roundMoney(Math.ceil(value / step) * step);
}

// Quick-tender presets for a cash row: the exact amount due, then the next
// AED 50 and AED 100 note above it. Duplicates (amount already a round 50/100)
// are dropped so the row never shows two buttons that fill the same value.
function tenderPresets(amountDue: number): { label: string; value: number }[] {
  if (amountDue <= 0) {
    return [];
  }

  const presets = [{ label: "Exact", value: roundMoney(amountDue) }];
  const next50 = roundUpTo(amountDue, 50);
  const next100 = roundUpTo(amountDue, 100);

  if (next50 !== presets[0]?.value) {
    presets.push({ label: formatMoney(next50), value: next50 });
  }
  if (next100 !== presets[0]?.value && next100 !== next50) {
    presets.push({ label: formatMoney(next100), value: next100 });
  }

  return presets;
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
  totals,
}: POSPaymentPanelProps): JSX.Element {
  const confirm = useConfirm();
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  // Display-only: what the cashier says the customer handed over, per cash
  // tender. Never sent in the checkout payload — `payment.amount` (what's
  // actually applied to the sale) is untouched. Drives the Change figure only.
  const [tenderedByMethodId, setTenderedByMethodId] = useState<Record<string, number | null>>({});

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
  const paymentRows: PaymentRow[] = payments.map((payment) => {
    const method = activeMethods.find((entry) => entry.id === payment.paymentMethodId);

    return {
      ...payment,
      methodType: method?.methodType ?? "",
      requiresReference: method?.requiresReference ?? false,
    };
  });
  const totalTendered = roundMoney(
    payments.reduce(
      (sum, payment) => sum + (tenderedByMethodId[payment.paymentMethodId] ?? payment.amount),
      0,
    ),
  );
  const displayChangeAmount = roundMoney(Math.max(totalTendered - totals.total, 0));

  const focusPaymentRow = (paymentMethodId: string): void => {
    rowRefs.current.get(paymentMethodId)?.querySelector<HTMLInputElement>("input")?.focus();
  };

  const clearTenderedFor = (paymentMethodId: string): void => {
    setTenderedByMethodId((prev) => {
      if (!(paymentMethodId in prev)) {
        return prev;
      }
      return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== paymentMethodId));
    });
  };

  const addOrReplacePayment = async (method: PaymentMethod): Promise<void> => {
    if (!method.defaultPaymentAccountId) {
      return;
    }

    const existingPayment = payments.find((payment) => payment.paymentMethodId === method.id);

    if (existingPayment) {
      // Tapping the method that's already selected did nothing before, with
      // no explanation. Send the cashier to the field they'd tap next instead.
      focusPaymentRow(method.id);
      return;
    }

    let amount = payments.length === 0 ? totals.total : totals.balanceDue;
    if (method.methodType === "store_credit") {
      amount = roundMoney(Math.min(amount, customerCreditBalance));
    }
    const nextPayment: PaymentInput = {
      paymentMethodId: method.id,
      paymentMethodName: method.methodName,
      amount,
      referenceNumber: null,
    };

    const willReplaceEnteredTenders = payments.length > 0 && !method.allowSplitPayment;

    if (willReplaceEnteredTenders) {
      const enteredMethodNames = payments.map((payment) => payment.paymentMethodName).join(", ");
      const confirmed = await confirm({
        cancelLabel: "Keep current payment",
        confirmLabel: `Switch to ${method.methodName}`,
        consequence: `This clears the ${enteredMethodNames} payment already entered and starts a single ${method.methodName} tender for the full total.`,
        detail: "Nothing has been charged yet — this only clears what's entered on this screen.",
        title: "Replace the current payment?",
      });

      if (!confirmed) {
        return;
      }
    }

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
    clearTenderedFor(paymentMethodId);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-cell font-medium text-foreground-muted">Payment</p>
        <p className="font-mono text-cell font-medium tabular-nums text-foreground">
          {formatMoney(totals.balanceDue)}
        </p>
      </div>
      {isLoading ? (
        <p className="text-cell rounded-md border border-border bg-muted px-3 py-2 text-foreground-muted">
          Loading POS payment methods...
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-cell rounded-md border border-danger/30 bg-danger-tint px-3 py-2 font-medium text-danger-text">
          {errorMessage}
        </p>
      ) : null}
      {!isLoading && !errorMessage && activeMethods.length === 0 ? (
        <p className="text-cell rounded-md border border-dashed border-border bg-card px-3 py-2 text-foreground-muted">
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
              onSelect={(selectedMethod) => {
                void addOrReplacePayment(selectedMethod);
              }}
              selected={payments.some((payment) => payment.paymentMethodId === method.id)}
            />
          ))}
        </div>
      ) : null}
      {unavailableMethods.length > 0 ? (
        <p className="text-cell rounded-md border border-border bg-muted px-3 py-2 text-foreground-muted">
          Active POS payment methods need linked default payment accounts before they can be used.
        </p>
      ) : null}
      {paymentRows.length > 0 ? (
        <div className="space-y-2">
          {paymentRows.map((payment) => {
            const isCash = payment.methodType === "cash";
            const isStoreCredit = payment.methodType === "store_credit";
            const tendered = tenderedByMethodId[payment.paymentMethodId] ?? null;
            const rowChange =
              tendered !== null ? roundMoney(Math.max(tendered - payment.amount, 0)) : 0;

            return (
              <div
                className="rounded-md border border-border bg-muted p-2"
                key={payment.paymentMethodId}
                ref={(node) => {
                  if (node) {
                    rowRefs.current.set(payment.paymentMethodId, node);
                  } else {
                    rowRefs.current.delete(payment.paymentMethodId);
                  }
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-cell font-medium text-foreground">
                    {payment.paymentMethodName}
                  </p>
                  <Button
                    aria-label={`Remove ${payment.paymentMethodName} payment`}
                    className="min-h-tap min-w-tap text-foreground-muted"
                    onClick={() => removePayment(payment.paymentMethodId)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <POSNumberInput
                  className="min-h-tap rounded-md border-border bg-card font-mono shadow-none focus-visible:ring-ring"
                  onValueChange={(amount) => {
                    const nextAmount = isStoreCredit
                      ? roundMoney(Math.min(amount ?? 0, customerCreditBalance))
                      : (amount ?? 0);
                    updatePayment(payment.paymentMethodId, { amount: nextAmount });
                  }}
                  placeholder="Paid amount"
                  value={payment.amount}
                />
                {isStoreCredit ? (
                  <p className="mt-1 text-meta text-foreground-muted">
                    Store credit balance: {formatMoney(customerCreditBalance)}
                  </p>
                ) : null}
                {payment.requiresReference ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-meta font-medium text-foreground-muted">
                      Reference number required
                    </p>
                    <Input
                      className="min-h-tap rounded-md border-border bg-card font-mono shadow-none focus-visible:ring-ring"
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
                {isCash ? (
                  <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                    <p className="text-meta font-medium text-foreground-muted">Cash tendered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tenderPresets(payment.amount).map((preset) => (
                        <Button
                          className="min-h-tap rounded-md border-border bg-card px-2.5 font-mono text-meta font-medium text-foreground hover:bg-muted"
                          key={preset.label}
                          onClick={() =>
                            setTenderedByMethodId((prev) => ({
                              ...prev,
                              [payment.paymentMethodId]: preset.value,
                            }))
                          }
                          type="button"
                          variant="outline"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <POSNumberInput
                      className="min-h-tap rounded-md border-border bg-card font-mono shadow-none focus-visible:ring-ring"
                      onValueChange={(value) =>
                        setTenderedByMethodId((prev) => ({
                          ...prev,
                          [payment.paymentMethodId]: value,
                        }))
                      }
                      placeholder="Cash handed over"
                      value={tendered}
                    />
                    {rowChange > 0 ? (
                      <p className="text-meta font-medium tabular-nums text-money-text">
                        Change due: {formatMoney(rowChange)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-cell rounded-md border border-dashed border-border bg-card px-3 py-2 text-foreground-muted">
          Select a payment method to start.
        </p>
      )}
      <div className="text-cell grid grid-cols-3 gap-2">
        <div>
          <p className="text-foreground-muted">Paid</p>
          <p className="font-mono font-medium tabular-nums text-foreground">
            {formatMoney(totals.paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-foreground-muted">Balance</p>
          <p className="font-mono font-medium tabular-nums text-foreground">
            {formatMoney(totals.balanceDue)}
          </p>
        </div>
        <div>
          <p className="text-foreground-muted">Change</p>
          <p className="font-mono font-medium tabular-nums text-foreground">
            {formatMoney(displayChangeAmount)}
          </p>
        </div>
      </div>
    </div>
  );
}
