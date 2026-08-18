"use client";

import type { JSX } from "react";
import { useEffect, useRef } from "react";

import { POSDiscountControl } from "@/components/pos/pos-discount-control";
import { POSPaymentPanel } from "@/components/pos/pos-payment-panel";
import { DocumentChargesEditor } from "@/components/shared/document-charges-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CheckoutFeedback } from "@/lib/pos/checkout-feedback";
import type { DocumentChargeDraft } from "@/types/document-charges";
import type { CartDiscountType, CartTotals, PaymentInput } from "@/types/pos";
import type { PaymentMethod, TaxRate } from "@/types/settings";

type POSCheckoutDialogProps = {
  charges: DocumentChargeDraft[];
  confirmButtonLabel: string;
  customerCreditBalance: number;
  customerId: string | null;
  feedback: CheckoutFeedback | null;
  // True while `resolveCheckoutBlocker` returned a blocker: no items, no
  // payment selected, an invalid amount, a missing reference, and so on.
  // Drives Confirm's visual weight only — the button stays clickable so the
  // on-tap blocker toast/feedback still fires and explains what to fix.
  hasBlocker: boolean;
  isSubmitting: boolean;
  onChargesChange: (charges: DocumentChargeDraft[]) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onPaymentsChange: (payments: PaymentInput[]) => void;
  onSaleDiscountChange: (type: CartDiscountType | null, value: number | null) => void;
  open: boolean;
  paymentMethodsError: Error | null;
  paymentMethodsLoading: boolean;
  paymentMethods: PaymentMethod[];
  payments: PaymentInput[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  taxRates: TaxRate[];
  totals: CartTotals;
};

const DEFAULT_CONFIRM_LABEL = "Confirm sale";
const UNDERPAYMENT_EPSILON = 0.0001;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function feedbackClassName(feedback: CheckoutFeedback): string {
  if (feedback.tone === "success") {
    return "border-money/30 bg-money-tint text-money-text";
  }
  if (feedback.tone === "warning") {
    return "border-warning/30 bg-warning-tint text-warning-text";
  }
  if (feedback.tone === "info") {
    return "border-info/30 bg-info-tint text-info-text";
  }
  return "border-danger/30 bg-danger-tint text-danger-text";
}

// P-07: `resolveCheckoutBlocker` never blocks underpayment — partial payment
// (account customers, bakery orders paid in part) is a supported POS action.
// But "Confirm sale" implies the sale is fully paid, so a cashier confirming
// with a balance still due is told, in the button itself, that they are
// creating a receivable rather than closing a paid sale.
function resolveConfirmLabel(confirmButtonLabel: string, totals: CartTotals): string {
  if (confirmButtonLabel !== DEFAULT_CONFIRM_LABEL) {
    return confirmButtonLabel;
  }

  const isUnderpaid = totals.total - totals.paidAmount > UNDERPAYMENT_EPSILON;

  if (!isUnderpaid) {
    return confirmButtonLabel;
  }

  return `Take ${formatMoney(totals.paidAmount)}, leave ${formatMoney(totals.balanceDue)} outstanding`;
}

export function POSCheckoutDialog({
  charges,
  confirmButtonLabel,
  customerCreditBalance,
  customerId,
  feedback,
  hasBlocker,
  isSubmitting,
  onChargesChange,
  onConfirm,
  onOpenChange,
  onPaymentsChange,
  onSaleDiscountChange,
  open,
  paymentMethodsError,
  paymentMethodsLoading,
  paymentMethods,
  payments,
  saleDiscountType,
  saleDiscountValue,
  taxRates,
  totals,
}: POSCheckoutDialogProps): JSX.Element {
  const cannotConfirm = isSubmitting || paymentMethodsLoading;
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  // The dialog scrolls internally; a blocker raised by tapping Confirm can
  // render below the visible area on a short (tablet-height) viewport. The
  // toast that also fires auto-dismisses, so the persistent explanation is
  // the one thing that must not be the part that scrolled away.
  useEffect(() => {
    if (feedback) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [feedback]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex bottom-5 left-auto right-5 top-auto max-h-[calc(100vh-7rem)] w-[calc(100vw-2.5rem)] max-w-[440px] translate-x-0 translate-y-0 flex-col overflow-hidden rounded-lg border-border bg-card p-5 text-foreground shadow-lg md:max-w-[480px] lg:max-w-[560px] xl:max-w-[560px] 2xl:max-w-[600px]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-title">Checkout</DialogTitle>
          <DialogDescription className="text-foreground-muted">
            Apply sale discount, split payment methods, and confirm the final checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-hidden min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="rounded-lg border border-border bg-muted p-4">
            <POSDiscountControl
              label="Sale discount"
              onChange={onSaleDiscountChange}
              type={saleDiscountType}
              value={saleDiscountValue}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted p-4">
            <DocumentChargesEditor
              charges={charges}
              compact
              onChange={onChargesChange}
              taxRates={taxRates}
            />
          </div>

          <POSPaymentPanel
            customerCreditBalance={customerCreditBalance}
            error={paymentMethodsError}
            hasCustomer={customerId !== null && customerId.length > 0}
            isLoading={paymentMethodsLoading}
            methods={paymentMethods}
            onPaymentsChange={onPaymentsChange}
            payments={payments}
            totals={totals}
          />

          <div className="text-cell space-y-1.5 rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between text-foreground-muted">
              <span>Subtotal</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-foreground-muted">
              <span>Discount</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between text-foreground-muted">
              <span>Item tax</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.taxAmount)}
              </span>
            </div>
            {totals.chargeAmount > 0 || totals.chargeTaxAmount > 0 ? (
              <>
                <div className="flex justify-between text-foreground-muted">
                  <span>Charges</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatMoney(totals.chargeAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-foreground-muted">
                  <span>Charge tax</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatMoney(totals.chargeTaxAmount)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <span className="text-body font-medium text-foreground">Total</span>
              <span className="text-total font-mono tabular-nums text-foreground">
                {formatMoney(totals.total)}
              </span>
            </div>
            <div className="flex justify-between text-foreground-muted">
              <span>Paid</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between text-foreground-muted">
              <span>Balance</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.balanceDue)}
              </span>
            </div>
            <div className="flex justify-between text-money-text">
              <span>Change</span>
              <span className="font-mono font-medium tabular-nums">
                {formatMoney(totals.changeAmount)}
              </span>
            </div>
          </div>

          {feedback ? (
            <div
              className={`text-cell rounded-md border px-3 py-2 font-medium ${feedbackClassName(feedback)}`}
              ref={feedbackRef}
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              <p className="font-medium">{feedback.title}</p>
              <p className="mt-1 leading-5">{feedback.message}</p>
              {feedback.showRetry ? (
                <Button
                  className="mt-2 rounded-md border-warning/40 bg-card text-warning-text hover:bg-warning-tint"
                  disabled={cannotConfirm}
                  onClick={onConfirm}
                  type="button"
                  variant="outline"
                >
                  Retry checkout
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 pt-4">
          <Button
            className="rounded-md border-border bg-card text-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className={
              hasBlocker && !cannotConfirm
                ? "rounded-md border border-border bg-muted text-foreground hover:bg-muted/80"
                : "rounded-md bg-primary text-primary-foreground hover:bg-primary"
            }
            disabled={cannotConfirm}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting
              ? "Processing..."
              : paymentMethodsLoading
                ? "Loading methods..."
                : resolveConfirmLabel(confirmButtonLabel, totals)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
