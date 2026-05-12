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

function expiryBadge(daysRemaining: number, status: string): JSX.Element {
  if (daysRemaining < 0 || status === "expired") {
    return <Badge className="border-red-200 bg-red-50 text-red-800">Expired</Badge>;
  }
  if (daysRemaining <= 7) {
    return <Badge className="border-red-200 bg-red-50 text-red-800">Urgent</Badge>;
  }
  if (daysRemaining <= 30) {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Expiring soon</Badge>;
  }

  return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Safe</Badge>;
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
            <TableCell>{expiryBadge(row.daysRemaining, row.status)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
