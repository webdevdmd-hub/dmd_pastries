import type { JSX } from "react";

import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IngredientConsumptionRow } from "@/types/manufacturing-reports";

export function IngredientConsumptionTable({
  rows,
}: {
  rows: IngredientConsumptionRow[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Consumed</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Estimated Cost</TableHead>
          <TableHead>Batch Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.inventoryItemId}>
            <TableCell className="font-semibold">{row.ingredientName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{formatNumber(row.totalConsumedQuantity)}</TableCell>
            <TableCell>{row.unitSymbol || "-"}</TableCell>
            <TableCell>{formatCurrency(row.estimatedCost)}</TableCell>
            <TableCell>{formatNumber(row.batchCount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
