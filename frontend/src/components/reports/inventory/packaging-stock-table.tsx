import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import type { PackagingStockRow } from "@/types/inventory-reports";

const columns: ReportColumn<PackagingStockRow>[] = [
  { cell: (row) => row.packagingName || "-", header: "Packaging", key: "packaging", primary: true },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  { cell: (row) => row.categoryName || "-", header: "Category", key: "category" },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.currentQuantity}</span>,
    header: "Current",
    key: "current",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.availableQuantity}</span>,
    header: "Available",
    key: "available",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.reorderLevel}</span>,
    header: <ReorderLevelHeader>Reorder</ReorderLevelHeader>,
    key: "reorder",
  },
  { align: "right", cell: (row) => row.unitSymbol || "-", header: "Unit", key: "unit" },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.costPerUnit)}</span>,
    header: "Cost / unit",
    key: "cost",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.stockValue)}</span>
    ),
    header: "Stock value",
    key: "value",
  },
  {
    cell: (row) =>
      row.isLowStock ? (
        <Badge className="border-warning/30 bg-warning-tint text-warning-text">Low stock</Badge>
      ) : (
        <Badge className="border-money/30 bg-money-tint text-money-text">Normal</Badge>
      ),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
];

export function PackagingStockTable({ rows }: { rows: PackagingStockRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.packagingItemId} rows={rows} />;
}
