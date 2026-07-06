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
    return "border-green-200 bg-green-50 text-green-800";
  }
  if (feedback.tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (feedback.tone === "info") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-red-200 bg-red-50 text-red-800";
}

export function POSCheckoutDialog({
  charges,
  confirmButtonLabel,
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
      <DialogContent className="scrollbar-hidden bottom-5 left-auto right-5 top-auto max-h-[calc(100vh-7rem)] w-[calc(100vw-2.5rem)] max-w-[440px] translate-x-0 translate-y-0 overflow-y-auto rounded-lg border-[#d4d4d8] bg-white p-5 text-[#09090b] shadow-lg xl:max-w-[460px] 2xl:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">Checkout</DialogTitle>
          <DialogDescription className="text-[#52525b]">
            Apply sale discount, split payment methods, and confirm the final checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#d4d4d8] bg-[#fafafa] p-4">
            <POSDiscountControl
              label="Sale discount"
              onChange={onSaleDiscountChange}
              type={saleDiscountType}
              value={saleDiscountValue}
            />
          </div>

          <div className="rounded-lg border border-[#d4d4d8] bg-[#fafafa] p-4">
            <DocumentChargesEditor
              charges={charges}
              compact
              onChange={onChargesChange}
              taxRates={taxRates}
            />
          </div>

          <POSPaymentPanel
            error={paymentMethodsError}
            isLoading={paymentMethodsLoading}
            methods={paymentMethods}
            onPaymentsChange={onPaymentsChange}
            payments={payments}
            total={totals.total}
          />

          <div className="rounded-lg border border-[#d4d4d8] bg-white p-4 font-mono text-sm">
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
            <div className="mt-3 flex justify-between border-t border-[#d4d4d8] pt-3 text-lg">
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
            <div className="flex justify-between text-green-800">
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
            <p className="font-black">{feedback.title}</p>
            <p className="mt-1 leading-5">{feedback.message}</p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            className="rounded-md border-[#d4d4d8] bg-white text-[#09090b] hover:bg-[#f4f4f5]"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="rounded-md bg-black text-white hover:bg-[#18181b]"
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
