import type { JSX } from "react";

import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecipeCostReportRow } from "@/types/manufacturing-reports";

export function RecipeCostTable({ rows }: { rows: RecipeCostReportRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipe</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Ingredient Cost</TableHead>
          <TableHead>Packaging Cost</TableHead>
          <TableHead>Total Cost</TableHead>
          <TableHead>Cost / Yield</TableHead>
          <TableHead>Yield Qty</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.recipeId}>
            <TableCell className="font-semibold">{row.recipeName || "-"}</TableCell>
            <TableCell>{row.productName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.estimatedIngredientCost)}</TableCell>
            <TableCell>{formatCurrency(row.estimatedPackagingCost)}</TableCell>
            <TableCell>{formatCurrency(row.estimatedTotalCost)}</TableCell>
            <TableCell>{formatCurrency(row.costPerYieldUnit)}</TableCell>
            <TableCell>{formatNumber(row.batchYieldQuantity)}</TableCell>
            <TableCell>v{formatNumber(row.versionNumber)}</TableCell>
            <TableCell>
              {row.isActive ? (
                <Badge className="border-money/30 bg-money-tint text-money-text">Active</Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
