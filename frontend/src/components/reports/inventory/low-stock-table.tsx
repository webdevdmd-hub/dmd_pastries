import type { JSX } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LowStockRow } from "@/types/inventory-reports";

export function LowStockTable({ rows }: { rows: LowStockRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Reorder Level</TableHead>
          <TableHead>Shortage</TableHead>
          <TableHead>Unit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.inventoryItemId}>
            <TableCell className="font-semibold">{row.itemName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.availableQuantity}</TableCell>
            <TableCell>{row.reorderLevel}</TableCell>
            <TableCell>{row.shortageQuantity}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
