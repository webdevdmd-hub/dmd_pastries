import { Eye, FileSearch, ReceiptText, Undo2 } from "lucide-react";
import type { JSX } from "react";

import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Button } from "@/components/ui/button";
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

type PaymentsTableProps = {
  canRefund: boolean;
  isReceiptLoading: boolean;
  onCreateReturn: (payment: SalePayment) => void;
  onView: (payment: SalePayment) => void;
  onViewReceipt: (payment: SalePayment) => void;
  onViewSaleDetails: (payment: SalePayment) => void;
  payments: SalePayment[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

function isRefundable(payment: SalePayment): boolean {
  return (
    payment.sourceType === "pos_sale" &&
    (payment.paymentStatus === "completed" || payment.paymentStatus === "partially_refunded")
  );
}

function refundDisabledReason(payment: SalePayment): string | null {
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

function sourceLabel(payment: SalePayment): string {
  return payment.sourceType === "bakery_order" ? "Bakery Order" : "POS Sale";
}

function paymentTypeLabel(payment: SalePayment): string {
  return orderPaymentTypeLabel(payment.paymentType);
}

export function PaymentsTable({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onView,
  onViewReceipt,
  onViewSaleDetails,
  payments,
}: PaymentsTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Cashier</TableHead>
          <TableHead>Paid At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>
              <span className="block font-bold text-brand-espresso">{payment.sourceNumber}</span>
              <span className="text-xs font-semibold text-brand-mocha">{sourceLabel(payment)}</span>
            </TableCell>
            <TableCell>{payment.customerName ?? "Walk-in customer"}</TableCell>
            <TableCell>
              <PaymentMethodBadge
                methodName={payment.paymentMethodNameSnapshot}
                methodType={payment.paymentMethodTypeSnapshot}
              />
            </TableCell>
            <TableCell className="capitalize">{paymentTypeLabel(payment)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatMoney(payment.amount)}
            </TableCell>
            <TableCell>
              <PaymentStatusBadge status={payment.paymentStatus} />
            </TableCell>
            <TableCell className="font-mono">{payment.referenceNumber ?? "No reference"}</TableCell>
            <TableCell>{payment.paidByUserName}</TableCell>
            <TableCell className="tabular-nums">{formatDate(payment.paidAt)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`View ${payment.sourceNumber}`}
                  onClick={() => onView(payment)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {payment.sourceType === "pos_sale" && payment.sourceId ? (
                  <>
                    <Button
                      aria-label={`View sale details for ${payment.sourceNumber}`}
                      onClick={() => onViewSaleDetails(payment)}
                      size="icon"
                      title="View sale details"
                      type="button"
                      variant="ghost"
                    >
                      <FileSearch className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={`View receipt for ${payment.sourceNumber}`}
                      disabled={isReceiptLoading}
                      onClick={() => onViewReceipt(payment)}
                      size="icon"
                      title="View receipt"
                      type="button"
                      variant="ghost"
                    >
                      <ReceiptText className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
                {canRefund ? (
                  <Button
                    aria-label={`Return items for ${payment.sourceNumber}`}
                    disabled={!isRefundable(payment)}
                    onClick={() => onCreateReturn(payment)}
                    size="icon"
                    title={refundDisabledReason(payment) ?? "Return items / credit note"}
                    type="button"
                    variant="ghost"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
