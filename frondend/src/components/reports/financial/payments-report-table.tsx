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
import type { PaymentsReportRow } from "@/types/financial-reports";

function statusBadge(status: string): JSX.Element {
  if (status === "completed" || status === "paid") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{status}</Badge>;
  }
  if (status === "pending" || status === "partial") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800">{status}</Badge>;
  }
  return <Badge className="border-red-200 bg-red-50 text-red-800">{status || "unknown"}</Badge>;
}

export function PaymentsReportTable({ rows }: { rows: PaymentsReportRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source Number</TableHead>
          <TableHead>Source Type</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Paid By</TableHead>
          <TableHead>Paid At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.paymentId || `${row.sourceNumber}-${row.paidAt}`}>
            <TableCell className="font-semibold">{row.sourceNumber || "-"}</TableCell>
            <TableCell>{row.sourceType || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.paymentMethodName || row.paymentMethodType || "-"}</TableCell>
            <TableCell>{formatCurrency(row.amount)}</TableCell>
            <TableCell>{statusBadge(row.status)}</TableCell>
            <TableCell>{row.referenceNumber || "-"}</TableCell>
            <TableCell>{row.paidByUserName || "-"}</TableCell>
            <TableCell>{formatDate(row.paidAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
