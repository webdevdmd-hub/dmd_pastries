"use client";

import type { JSX } from "react";

import { POSDiscountControl } from "@/components/pos/pos-discount-control";
import { POSPaymentPanel } from "@/components/pos/pos-payment-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CartDiscountType, CartTotals, PaymentInput } from "@/types/pos";
import type { PaymentMethod } from "@/types/settings";

type POSCheckoutDialogProps = {
  isSubmitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onPaymentsChange: (payments: PaymentInput[]) => void;
  onSaleDiscountChange: (type: CartDiscountType | null, value: number | null) => void;
  open: boolean;
  paymentMethods: PaymentMethod[];
  payments: PaymentInput[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  totals: CartTotals;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function POSCheckoutDialog({
  isSubmitting,
  onConfirm,
  onOpenChange,
  onPaymentsChange,
  onSaleDiscountChange,
  open,
  paymentMethods,
  payments,
  saleDiscountType,
  saleDiscountValue,
  totals,
}: POSCheckoutDialogProps): JSX.Element {
  const hasMissingRequiredReference = payments.some((payment) => {
    const method = paymentMethods.find((entry) => entry.id === payment.paymentMethodId);
    return method?.requiresReference === true && !payment.referenceNumber?.trim();
  });
  const cannotConfirm = isSubmitting || payments.length === 0 || hasMissingRequiredReference;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="scrollbar-hidden bottom-5 left-auto right-5 top-auto max-h-[calc(100vh-7rem)] w-[calc(100vw-2.5rem)] max-w-[440px] translate-x-0 translate-y-0 overflow-y-auto rounded-[2rem] border-brand-cappuccino/80 bg-white/95 p-5 shadow-[0_28px_90px_rgba(59,42,34,0.24)] backdrop-blur xl:max-w-[460px] 2xl:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            Apply sale discount, split payment methods, and confirm the final checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-3xl border border-brand-cappuccino/70 bg-brand-latte/65 p-4">
            <POSDiscountControl
              label="Sale discount"
              onChange={onSaleDiscountChange}
              type={saleDiscountType}
              value={saleDiscountValue}
            />
          </div>

          <POSPaymentPanel
            methods={paymentMethods}
            onPaymentsChange={onPaymentsChange}
            payments={payments}
            total={totals.total}
          />

          <div className="rounded-3xl bg-brand-latte p-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <strong>{formatMoney(totals.discountAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <strong>{formatMoney(totals.taxAmount)}</strong>
            </div>
            <div className="mt-3 flex justify-between border-t border-brand-cappuccino pt-3 text-lg">
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

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={cannotConfirm} onClick={onConfirm} type="button">
            {isSubmitting
              ? "Processing..."
              : hasMissingRequiredReference
                ? "Reference required"
                : "Confirm sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
