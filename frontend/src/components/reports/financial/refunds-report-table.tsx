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
    return <Badge className="border-money/30 bg-money-tint text-money-text">Completed</Badge>;
  }
  if (status === "pending") {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">Pending</Badge>;
  }
  return (
    <Badge className="border-danger/30 bg-danger-tint text-danger-text">{status || "Failed"}</Badge>
  );
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
            <TableCell className="min-w-64 whitespace-normal">{row.refundReason || "-"}</TableCell>
            <TableCell>{refundBadge(row.refundStatus)}</TableCell>
            <TableCell>{row.createdByUserName || "-"}</TableCell>
            <TableCell>{formatDate(row.refundedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
