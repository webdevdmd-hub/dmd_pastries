import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { IngredientConsumptionRow } from "@/types/manufacturing-reports";

const columns: ReportColumn<IngredientConsumptionRow>[] = [
  {
    cell: (row) => row.ingredientName || "-",
    header: "Ingredient",
    key: "ingredient",
    primary: true,
  },
  {
    cell: (row) => row.branchName || "-",
    header: "Branch",
    key: "branch",
    secondary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.totalConsumedQuantity)}</span>,
    header: "Consumed",
    key: "consumed",
  },
  {
    align: "right",
    cell: (row) => row.unitSymbol || "-",
    header: "Unit",
    key: "unit",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.estimatedCost)}</span>
    ),
    header: "Estimated cost",
    key: "cost",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.batchCount)}</span>,
    header: "Batches",
    key: "batches",
  },
];

export function IngredientConsumptionTable({
  rows,
}: {
  rows: IngredientConsumptionRow[];
}): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.inventoryItemId} rows={rows} />;
}
