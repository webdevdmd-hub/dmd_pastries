"use client";

import type { JSX } from "react";

import { PaymentActionsMenu } from "@/components/payments/payment-actions-menu";
import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orderPaymentTypeLabel } from "@/lib/orders/payment-stage";
import type { SalePayment } from "@/types/payment";

export type PaymentsListProps = {
  canRefund: boolean;
  isReceiptLoading: boolean;
  onCreateReturn: (payment: SalePayment) => void;
  /** Opens the payment's details; the whole row is the target. */
  onView: (payment: SalePayment) => void;
  onViewReceipt: (payment: SalePayment) => void;
  onViewSaleDetails: (payment: SalePayment) => void;
  payments: SalePayment[];
};

export function formatPaymentMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatPaymentDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

export function paymentSourceLabel(payment: SalePayment): string {
  return payment.sourceType === "bakery_order" ? "Bakery Order" : "POS Sale";
}

export function PaymentsTable({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onView,
  onViewReceipt,
  onViewSaleDetails,
  payments,
}: PaymentsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Payment method</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Cashier</TableHead>
          <TableHead>Paid at</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          // The row opens the drawer; the sale number is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={payment.id} onClick={() => onView(payment)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(payment);
                }}
                type="button"
              >
                {/* The sale number is an identifier: mono, and it must not wrap. */}
                <span className="font-mono font-medium">{payment.sourceNumber}</span>
                <span className="text-meta text-foreground-muted">
                  {paymentSourceLabel(payment)}
                </span>
              </button>
            </TableCell>
            <TableCell>{payment.customerName ?? "Walk-in customer"}</TableCell>
            <TableCell>
              <PaymentMethodBadge methodName={payment.paymentMethodNameSnapshot} />
            </TableCell>
            <TableCell className="capitalize">
              {orderPaymentTypeLabel(payment.paymentType)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatPaymentMoney(payment.amount)}
            </TableCell>
            <TableCell>
              <PaymentStatusBadge status={payment.paymentStatus} />
            </TableCell>
            <TableCell className="font-mono">{payment.referenceNumber ?? "No reference"}</TableCell>
            <TableCell>{payment.paidByUserName}</TableCell>
            <TableCell className="tabular-nums">{formatPaymentDate(payment.paidAt)}</TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <PaymentActionsMenu
                canRefund={canRefund}
                isReceiptLoading={isReceiptLoading}
                onCreateReturn={onCreateReturn}
                onViewReceipt={onViewReceipt}
                onViewSaleDetails={onViewSaleDetails}
                payment={payment}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
