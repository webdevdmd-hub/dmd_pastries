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
import type { ReconciliationRow } from "@/types/financial-reports";

function directionBadge(direction: string): JSX.Element {
  if (direction === "in") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">In</Badge>;
  }
  return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Out</Badge>;
}

export function ReconciliationReportTable({ rows }: { rows: ReconciliationRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Direction</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.transactionId || `${row.sourceType}-${row.sourceNumber}-${row.transactionAt}`}
          >
            <TableCell>{formatDate(row.transactionAt)}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.transactionType || "-"}</TableCell>
            <TableCell>{row.sourceType || "-"}</TableCell>
            <TableCell>{row.sourceNumber || "-"}</TableCell>
            <TableCell>{row.paymentMethodName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.amount)}</TableCell>
            <TableCell>{directionBadge(row.direction)}</TableCell>
            <TableCell>{row.status || "-"}</TableCell>
            <TableCell>{row.createdByUserName || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
