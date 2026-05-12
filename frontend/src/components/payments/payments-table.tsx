import { Eye, RotateCcw } from "lucide-react";
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
import type { SalePayment } from "@/types/payment";

type PaymentsTableProps = {
  canRefund: boolean;
  onRefund: (payment: SalePayment) => void;
  onView: (payment: SalePayment) => void;
  payments: SalePayment[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

function isRefundable(payment: SalePayment): boolean {
  return payment.paymentStatus === "completed" || payment.paymentStatus === "partially_refunded";
}

function refundDisabledReason(payment: SalePayment): string | null {
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

export function PaymentsTable({
  canRefund,
  onRefund,
  onView,
  payments,
}: PaymentsTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sale Number</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Amount</TableHead>
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
            <TableCell className="font-bold">{payment.saleNumber}</TableCell>
            <TableCell>
              <PaymentMethodBadge
                methodName={payment.paymentMethodNameSnapshot}
                methodType={payment.paymentMethodTypeSnapshot}
              />
            </TableCell>
            <TableCell className="font-black">{formatMoney(payment.amount)}</TableCell>
            <TableCell>
              <PaymentStatusBadge status={payment.paymentStatus} />
            </TableCell>
            <TableCell>{payment.referenceNumber ?? "No reference"}</TableCell>
            <TableCell>{payment.paidByUserName}</TableCell>
            <TableCell>{formatDate(payment.paidAt)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`View ${payment.saleNumber}`}
                  onClick={() => onView(payment)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {canRefund ? (
                  <Button
                    aria-label={`Refund ${payment.saleNumber}`}
                    disabled={!isRefundable(payment)}
                    onClick={() => onRefund(payment)}
                    size="icon"
                    title={refundDisabledReason(payment) ?? "Refund payment"}
                    type="button"
                    variant="ghost"
                  >
                    <RotateCcw className="h-4 w-4" />
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
