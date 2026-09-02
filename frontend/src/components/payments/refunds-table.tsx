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
          <TableHead className="whitespace-nowrap">Refund Number</TableHead>
          <TableHead className="whitespace-nowrap">Sale Number</TableHead>
          <TableHead className="whitespace-nowrap">Payment Method</TableHead>
          <TableHead className="whitespace-nowrap text-right">Refund Amount</TableHead>
          <TableHead className="whitespace-nowrap">Status</TableHead>
          <TableHead className="whitespace-nowrap">Reason</TableHead>
          <TableHead className="whitespace-nowrap">Created By</TableHead>
          <TableHead className="whitespace-nowrap">Refunded At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {refunds.map((refund) => (
          <TableRow key={refund.id}>
            <TableCell className="whitespace-nowrap font-bold">{refund.refundNumber}</TableCell>
            <TableCell className="whitespace-nowrap">{refund.saleNumber}</TableCell>
            <TableCell className="whitespace-nowrap">
              <PaymentMethodBadge methodName={refund.paymentMethodNameSnapshot} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
              {formatMoney(refund.refundAmount)}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <PaymentStatusBadge status={refund.refundStatus} />
            </TableCell>
            <TableCell className="whitespace-nowrap max-w-64 truncate">
              {refund.refundReason}
            </TableCell>
            <TableCell className="whitespace-nowrap">{refund.createdByUserName}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDate(refund.refundedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
