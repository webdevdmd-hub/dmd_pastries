import type { JSX } from "react";

import { formatDate, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManufacturingWastageRow } from "@/types/manufacturing-reports";

function wastageBadge(type: string): JSX.Element {
  if (type === "finished_goods_wastage")
    return (
      <Badge className="border-danger/30 bg-danger-tint text-danger-text">Finished goods</Badge>
    );
  return (
    <Badge className="border-warning/30 bg-warning-tint text-warning-text">
      {type.replaceAll("_", " ") || "Wastage"}
    </Badge>
  );
}

export function ManufacturingWastageTable({
  rows,
}: {
  rows: ManufacturingWastageRow[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.itemName}-${row.createdAt}-${String(index)}`}>
            <TableCell className="font-semibold">{row.itemName || "-"}</TableCell>
            <TableCell>{wastageBadge(row.wastageType)}</TableCell>
            <TableCell>{formatNumber(row.quantity)}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell>{row.reason || "-"}</TableCell>
            <TableCell>{row.batchNumber || "-"}</TableCell>
            <TableCell>{formatDate(row.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
