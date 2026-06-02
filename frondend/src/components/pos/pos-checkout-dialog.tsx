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
import type { PaymentMethod, SalesChannel } from "@/types/settings";

type POSCheckoutDialogProps = {
  isSubmitting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onPaymentsChange: (payments: PaymentInput[]) => void;
  onSaleDiscountChange: (type: CartDiscountType | null, value: number | null) => void;
  open: boolean;
  externalOrderNumber: string;
  paymentMethods: PaymentMethod[];
  payments: PaymentInput[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  salesChannelId: string;
  salesChannels: SalesChannel[];
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
  externalOrderNumber,
  paymentMethods,
  payments,
  saleDiscountType,
  saleDiscountValue,
  salesChannelId,
  salesChannels,
  totals,
}: POSCheckoutDialogProps): JSX.Element {
  const selectedChannel = salesChannels.find((channel) => channel.id === salesChannelId) ?? null;
  const hasMissingRequiredReference = payments.some((payment) => {
    const method = paymentMethods.find((entry) => entry.id === payment.paymentMethodId);
    return method?.requiresReference === true && !payment.referenceNumber?.trim();
  });
  const hasMissingExternalOrderNumber =
    selectedChannel?.requiresExternalOrderNumber === true &&
    externalOrderNumber.trim().length === 0;
  const cannotConfirm =
    isSubmitting ||
    payments.length === 0 ||
    hasMissingRequiredReference ||
    hasMissingExternalOrderNumber;

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

          <POSPaymentPanel
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
              <span>Tax</span>
              <strong>{formatMoney(totals.taxAmount)}</strong>
            </div>
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
              : hasMissingExternalOrderNumber
                ? "Order number required"
                : hasMissingRequiredReference
                  ? "Reference required"
                  : "Confirm sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
