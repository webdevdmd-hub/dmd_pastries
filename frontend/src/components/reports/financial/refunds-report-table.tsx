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
import type { RefundReportRow } from "@/types/financial-reports";

function refundBadge(status: string): JSX.Element {
  if (status === "completed") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Completed</Badge>;
  }
  if (status === "pending") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Pending</Badge>;
  }
  return <Badge className="border-red-200 bg-red-50 text-red-800">{status || "Failed"}</Badge>;
}

export function RefundsReportTable({ rows }: { rows: RefundReportRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source Number</TableHead>
          <TableHead>Source Type</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Refund Amount</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Refunded By</TableHead>
          <TableHead>Refunded At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.refundId || `${row.sourceNumber}-${row.refundedAt}`}>
            <TableCell className="font-semibold">{row.sourceNumber || "-"}</TableCell>
            <TableCell>{row.sourceType || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.paymentMethodName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.refundAmount)}</TableCell>
            <TableCell>{row.refundReason || "-"}</TableCell>
            <TableCell>{refundBadge(row.refundStatus)}</TableCell>
            <TableCell>{row.createdByUserName || "-"}</TableCell>
            <TableCell>{formatDate(row.refundedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
