"use client";

import type { JSX } from "react";

import { PaymentActionsMenu } from "@/components/payments/payment-actions-menu";
import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import {
  formatPaymentDate,
  formatPaymentMoney,
  type PaymentsListProps,
  paymentSourceLabel,
} from "@/components/payments/payments-table";
import { Card } from "@/components/ui/card";
import { orderPaymentTypeLabel } from "@/lib/orders/payment-stage";

/**
 * The payments ledger as cards, for phones: a ten-column table has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function PaymentsCardGrid({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onView,
  onViewReceipt,
  onViewSaleDetails,
  payments,
}: PaymentsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {payments.map((payment) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={payment.id}
          onClick={() => onView(payment)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(payment);
              }}
              type="button"
            >
              <span className="truncate font-mono font-medium">{payment.sourceNumber}</span>
              <span className="text-meta text-foreground-muted">
                {paymentSourceLabel(payment)} · {payment.customerName ?? "Walk-in customer"}
              </span>
            </button>
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <PaymentStatusBadge status={payment.paymentStatus} />
              <PaymentActionsMenu
                canRefund={canRefund}
                isReceiptLoading={isReceiptLoading}
                onCreateReturn={onCreateReturn}
                onViewReceipt={onViewReceipt}
                onViewSaleDetails={onViewSaleDetails}
                payment={payment}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-cell">
            <PaymentMethodBadge methodName={payment.paymentMethodNameSnapshot} />
            <span className="capitalize text-foreground-muted">
              {orderPaymentTypeLabel(payment.paymentType)}
            </span>
            <span className="ml-auto text-title font-medium tabular-nums">
              {formatPaymentMoney(payment.amount)}
            </span>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Cashier</p>
              <p className="mt-1 truncate text-cell font-medium">{payment.paidByUserName}</p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Paid at</p>
              <p className="mt-1 truncate text-cell font-medium tabular-nums">
                {formatPaymentDate(payment.paidAt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
