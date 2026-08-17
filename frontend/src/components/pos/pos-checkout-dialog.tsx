"use client";

import type { JSX } from "react";

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

export function POSCheckoutDialog({
  charges,
  confirmButtonLabel,
  customerCreditBalance,
  customerId,
  feedback,
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="scrollbar-hidden bottom-5 left-auto right-5 top-auto max-h-[calc(100vh-7rem)] w-[calc(100vw-2.5rem)] max-w-[440px] translate-x-0 translate-y-0 overflow-y-auto rounded-lg border-border bg-card p-5 text-foreground shadow-lg xl:max-w-[460px] 2xl:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-title">Checkout</DialogTitle>
          <DialogDescription className="text-foreground-muted">
            Apply sale discount, split payment methods, and confirm the final checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            total={totals.total}
          />

          <div className="rounded-lg border border-border bg-card p-4 font-mono text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <strong>{formatMoney(totals.discountAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Item tax</span>
              <strong>{formatMoney(totals.taxAmount)}</strong>
            </div>
            {totals.chargeAmount > 0 || totals.chargeTaxAmount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span>Charges</span>
                  <strong>{formatMoney(totals.chargeAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Charge tax</span>
                  <strong>{formatMoney(totals.chargeTaxAmount)}</strong>
                </div>
              </>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg">
              <span>Total</span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Paid</span>
              <strong>{formatMoney(totals.paidAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Balance</span>
              <strong>{formatMoney(totals.balanceDue)}</strong>
            </div>
            <div className="flex justify-between text-money-text">
              <span>Change</span>
              <strong>{formatMoney(totals.changeAmount)}</strong>
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${feedbackClassName(feedback)}`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            <p className="font-medium">{feedback.title}</p>
            <p className="mt-1 leading-5">{feedback.message}</p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            className="rounded-md border-border bg-card text-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="rounded-md bg-primary text-primary-foreground hover:bg-primary"
            disabled={cannotConfirm}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting
              ? "Processing..."
              : paymentMethodsLoading
                ? "Loading methods..."
                : confirmButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
