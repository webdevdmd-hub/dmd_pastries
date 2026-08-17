import type { JSX } from "react";

import { formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExpiryReportRow } from "@/types/inventory-reports";

function expiryBadge(state: string, label: string): JSX.Element {
  if (state === "expired") {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">{label}</Badge>;
  }
  if (state === "expires_today") {
    return <Badge className="border-orange-200 bg-orange-50 text-orange-800">{label}</Badge>;
  }
  return <Badge className="border-warning/30 bg-warning-tint text-warning-text">{label}</Badge>;
}

export function ExpiryReportTable({ rows }: { rows: ExpiryReportRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Days Left</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.batchId}>
            <TableCell className="font-semibold">{row.itemName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.batchNumber || "-"}</TableCell>
            <TableCell>
              {row.quantity} {row.unitSymbol}
            </TableCell>
            <TableCell>{formatDate(row.receivedDate)}</TableCell>
            <TableCell>{formatDate(row.expiryDate)}</TableCell>
            <TableCell>{row.daysRemaining}</TableCell>
            <TableCell>{expiryBadge(row.expiryState, row.expiryStateLabel)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
