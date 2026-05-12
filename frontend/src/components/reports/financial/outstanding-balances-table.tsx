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
import type { OutstandingBalanceRow } from "@/types/financial-reports";

function paymentBadge(status: string): JSX.Element {
  if (status === "paid") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Paid</Badge>;
  }
  if (status === "partial") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Partial</Badge>;
  }
  return <Badge className="border-red-200 bg-red-50 text-red-800">{status || "Unpaid"}</Badge>;
}

export function OutstandingBalancesTable({ rows }: { rows: OutstandingBalanceRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source Number</TableHead>
          <TableHead>Source Type</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.sourceType}-${row.sourceNumber}`}>
            <TableCell className="font-semibold">{row.sourceNumber || "-"}</TableCell>
            <TableCell>{row.sourceType || "-"}</TableCell>
            <TableCell>{row.customerName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
            <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
            <TableCell className={row.balanceAmount > 0 ? "font-semibold text-red-800" : ""}>
              {formatCurrency(row.balanceAmount)}
            </TableCell>
            <TableCell>{paymentBadge(row.paymentStatus)}</TableCell>
            <TableCell>{formatDate(row.dueDate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
