import type { JSX } from "react";

import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PackagingStockRow } from "@/types/inventory-reports";

export function PackagingStockTable({ rows }: { rows: PackagingStockRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Packaging</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Reorder</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Cost / Unit</TableHead>
          <TableHead>Stock Value</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.packagingItemId}>
            <TableCell className="font-semibold">{row.packagingName || "-"}</TableCell>
            <TableCell>{row.categoryName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.currentQuantity}</TableCell>
            <TableCell>{row.availableQuantity}</TableCell>
            <TableCell>{row.reorderLevel}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell>{formatCurrency(row.costPerUnit)}</TableCell>
            <TableCell>{formatCurrency(row.stockValue)}</TableCell>
            <TableCell>
              {row.isLowStock ? (
                <Badge className="border-amber-200 bg-amber-50 text-amber-800">Low stock</Badge>
              ) : (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Normal</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
