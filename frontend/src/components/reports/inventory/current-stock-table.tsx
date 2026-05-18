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
    return <Badge className="border-red-200 bg-red-50 text-red-800">Out of stock</Badge>;
  }
  if (row.isLowStock) {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Low stock</Badge>;
  }

  return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Normal</Badge>;
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
