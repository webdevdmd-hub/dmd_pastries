import type { JSX } from "react";

import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockValuationRow } from "@/types/inventory-reports";

export function StockValuationTable({ rows }: { rows: StockValuationRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Current Qty</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Unit Cost</TableHead>
          <TableHead>Stock Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.inventoryItemId}>
            <TableCell className="font-semibold">{row.itemName || "-"}</TableCell>
            <TableCell className="capitalize">{row.itemType || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.currentQuantity}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell>{formatCurrency(row.unitCost)}</TableCell>
            <TableCell>{formatCurrency(row.stockValue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
