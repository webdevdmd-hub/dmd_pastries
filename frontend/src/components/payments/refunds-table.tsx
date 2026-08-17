import type { JSX } from "react";

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
import type { PaymentRefund } from "@/types/payment";

type RefundsTableProps = {
  refunds: PaymentRefund[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Pending";
}

export function RefundsTable({ refunds }: RefundsTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Refund Number</TableHead>
          <TableHead>Sale Number</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Refund Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Refunded At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {refunds.map((refund) => (
          <TableRow key={refund.id}>
            <TableCell className="font-bold">{refund.refundNumber}</TableCell>
            <TableCell>{refund.saleNumber}</TableCell>
            <TableCell>
              <PaymentMethodBadge methodName={refund.paymentMethodNameSnapshot} />
            </TableCell>
            <TableCell className="font-medium">{formatMoney(refund.refundAmount)}</TableCell>
            <TableCell>
              <PaymentStatusBadge status={refund.refundStatus} />
            </TableCell>
            <TableCell className="max-w-64 truncate">{refund.refundReason}</TableCell>
            <TableCell>{refund.createdByUserName}</TableCell>
            <TableCell>{formatDate(refund.refundedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
