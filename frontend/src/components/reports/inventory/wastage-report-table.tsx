import type { JSX } from "react";

import { formatDate } from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WastageReportItem } from "@/types/inventory-reports";

export function WastageReportTable({ rows }: { rows: WastageReportItem[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Created At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.itemName}-${row.createdAt}-${String(index)}`}>
            <TableCell className="font-semibold">{row.itemName || "-"}</TableCell>
            <TableCell className="capitalize">{row.itemType || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.quantity}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell className="min-w-64 whitespace-normal">{row.reason || "-"}</TableCell>
            <TableCell>{formatDate(row.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
