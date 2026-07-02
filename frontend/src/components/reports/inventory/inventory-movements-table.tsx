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
import type { InventoryMovementReportRow } from "@/types/inventory-reports";

function movementTypeLabel(value: string): string {
  if (value === "transfer") {
    return "Stock Transfer";
  }

  return value.replaceAll("_", " ");
}

export function InventoryMovementsTable({
  rows,
}: {
  rows: InventoryMovementReportRow[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Movement</TableHead>
          <TableHead>Direction</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.movementId}>
            <TableCell>{formatDate(row.date)}</TableCell>
            <TableCell className="font-semibold">{row.itemName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell className="capitalize">{movementTypeLabel(row.movementType)}</TableCell>
            <TableCell className="capitalize">{row.movementDirection || "-"}</TableCell>
            <TableCell>{row.quantity}</TableCell>
            <TableCell>{row.beforeQuantity}</TableCell>
            <TableCell>{row.afterQuantity}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell>{row.referenceNumber || "-"}</TableCell>
            <TableCell>{row.createdBy || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
