"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SalePayment } from "@/types/payment";

type PaymentActionsMenuProps = {
  canRefund: boolean;
  isReceiptLoading: boolean;
  onCreateReturn: (payment: SalePayment) => void;
  onViewReceipt: (payment: SalePayment) => void;
  onViewSaleDetails: (payment: SalePayment) => void;
  payment: SalePayment;
};

export function isRefundablePayment(payment: SalePayment): boolean {
  return (
    payment.sourceType === "pos_sale" &&
    (payment.paymentStatus === "completed" || payment.paymentStatus === "partially_refunded")
  );
}

export function refundDisabledReason(payment: SalePayment): string | null {
  if (payment.sourceType !== "pos_sale") {
    return "Refund actions are currently available for POS sale payments only.";
  }

  if (payment.paymentStatus === "refunded") {
    return "This payment is already fully refunded.";
  }

  if (payment.paymentStatus === "failed") {
    return "Failed payments cannot be refunded.";
  }

  if (payment.paymentStatus === "pending") {
    return "Pending payments cannot be refunded until completed.";
  }

  return null;
}

/**
 * Actions only. Viewing is the row's own click. A bakery-order payment has
 * no POS sale behind it, so it gets no receipt, no sale page and no return;
 * the menu then has nothing to offer and renders nothing.
 */
export function PaymentActionsMenu({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onViewReceipt,
  onViewSaleDetails,
  payment,
}: PaymentActionsMenuProps): JSX.Element | null {
  const isPosSale = payment.sourceType === "pos_sale" && Boolean(payment.sourceId);

  if (!isPosSale) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${payment.sourceNumber}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onViewSaleDetails(payment)}>
          Sale details
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isReceiptLoading} onSelect={() => onViewReceipt(payment)}>
          Open receipt
        </DropdownMenuItem>
        {canRefund ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex-col items-start gap-0.5"
              disabled={!isRefundablePayment(payment)}
              onSelect={() => onCreateReturn(payment)}
            >
              <span>Return items</span>
              <span className="text-meta text-foreground-muted">
                {refundDisabledReason(payment) ?? "Creates a credit note."}
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
