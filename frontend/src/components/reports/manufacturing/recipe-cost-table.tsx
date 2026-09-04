import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { RecipeCostReportRow } from "@/types/manufacturing-reports";

const columns: ReportColumn<RecipeCostReportRow>[] = [
  {
    cell: (row) => row.recipeName || "-",
    header: "Recipe",
    key: "recipe",
    primary: true,
  },
  {
    cell: (row) => row.productName || "-",
    header: "Product",
    key: "product",
    secondary: true,
  },
  {
    cell: (row) =>
      row.isActive ? (
        <Badge className="border-money/30 bg-money-tint text-money-text">Active</Badge>
      ) : (
        <Badge variant="outline">Inactive</Badge>
      ),
    header: "Active",
    key: "active",
    unlabelledOnCard: true,
  },
  {
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">{formatCurrency(row.estimatedIngredientCost)}</span>
    ),
    header: "Ingredient cost",
    key: "ingredient-cost",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">{formatCurrency(row.estimatedPackagingCost)}</span>
    ),
    header: "Packaging cost",
    key: "packaging-cost",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.estimatedTotalCost)}</span>
    ),
    header: "Total cost",
    key: "total-cost",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.costPerYieldUnit)}</span>,
    header: "Cost / yield",
    key: "cost-per-yield",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.batchYieldQuantity)}</span>,
    header: "Yield qty",
    key: "yield",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">v{formatNumber(row.versionNumber)}</span>,
    header: "Version",
    key: "version",
  },
];

export function RecipeCostTable({ rows }: { rows: RecipeCostReportRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.recipeId} rows={rows} />;
}
