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

function differenceBadge(value: number): JSX.Element {
  if (value === 0) {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Balanced</Badge>;
  }
  if (value > 0) {
    return <Badge className="border-sky-200 bg-sky-50 text-sky-800">Surplus</Badge>;
  }
  return <Badge className="border-red-200 bg-red-50 text-red-800">Shortage</Badge>;
}

export function ReconciliationReportTable({ rows }: { rows: ReconciliationRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Payment Method</TableHead>
          <TableHead>Expected</TableHead>
          <TableHead>Counted</TableHead>
          <TableHead>Difference</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.reconciliationId || `${row.branchName}-${row.reconciliationDate}`}>
            <TableCell>{formatDate(row.reconciliationDate)}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.paymentMethodName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.expectedAmount)}</TableCell>
            <TableCell>{formatCurrency(row.countedAmount)}</TableCell>
            <TableCell>{formatCurrency(row.differenceAmount)}</TableCell>
            <TableCell>{differenceBadge(row.differenceAmount)}</TableCell>
            <TableCell>{row.createdByUserName || row.status || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
