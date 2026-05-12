import type { JSX } from "react";

import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PendingPaymentRow } from "@/types/bakery-orders-reports";

function paymentBadge(status: string): JSX.Element {
  if (status === "paid")
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Paid</Badge>;
  if (status === "partial")
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Partial</Badge>;
  return <Badge className="border-red-200 bg-red-50 text-red-800">{status || "Unpaid"}</Badge>;
}

export function PendingPaymentsTable({ rows }: { rows: PendingPaymentRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Event Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.orderNumber}>
            <TableCell className="font-semibold">{row.orderNumber || "-"}</TableCell>
            <TableCell>{row.customerName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
            <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
            <TableCell>{formatCurrency(row.balanceAmount)}</TableCell>
            <TableCell>{paymentBadge(row.paymentStatus)}</TableCell>
            <TableCell>{formatDate(row.eventDate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
