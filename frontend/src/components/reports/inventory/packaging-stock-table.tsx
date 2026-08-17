import type { JSX } from "react";

import { formatCurrency } from "@/components/reports/sales/sales-report-format";
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
          <TableHead>
            <ReorderLevelHeader>Reorder</ReorderLevelHeader>
          </TableHead>
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
                <Badge className="border-warning/30 bg-warning-tint text-warning-text">
                  Low stock
                </Badge>
              ) : (
                <Badge className="border-money/30 bg-money-tint text-money-text">Normal</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
