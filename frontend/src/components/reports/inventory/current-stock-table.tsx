import type { JSX } from "react";

import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CurrentStockRow } from "@/types/inventory-reports";

function stockBadge(row: CurrentStockRow): JSX.Element {
  if (row.isOutOfStock) {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Out of stock</Badge>;
  }
  if (row.isLowStock) {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">Low stock</Badge>;
  }

  return <Badge className="border-money/30 bg-money-tint text-money-text">Normal</Badge>;
}

export function CurrentStockTable({ rows }: { rows: CurrentStockRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>Reserved</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>
            <ReorderLevelHeader>Reorder</ReorderLevelHeader>
          </TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.inventoryItemId}>
            <TableCell>
              <div className="font-semibold">{row.itemName || "-"}</div>
              <div className="text-xs text-brand-mocha">{row.itemCode || "-"}</div>
            </TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell className="capitalize">{row.itemType || "-"}</TableCell>
            <TableCell>{row.currentQuantity}</TableCell>
            <TableCell>{row.reservedQuantity}</TableCell>
            <TableCell>{row.availableQuantity}</TableCell>
            <TableCell>{row.reorderLevel}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell>{stockBadge(row)}</TableCell>
            <TableCell className="capitalize">{row.status || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
