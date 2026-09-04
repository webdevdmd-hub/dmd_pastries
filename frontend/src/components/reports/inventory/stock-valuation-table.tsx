import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import type { StockValuationRow } from "@/types/inventory-reports";

const columns: ReportColumn<StockValuationRow>[] = [
  { cell: (row) => row.itemName || "-", header: "Item", key: "item", primary: true },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  {
    cell: (row) => <span className="capitalize">{row.itemType || "-"}</span>,
    header: "Type",
    key: "type",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.currentQuantity}</span>,
    header: "Current qty",
    key: "quantity",
  },
  { align: "right", cell: (row) => row.unitSymbol || "-", header: "Unit", key: "unit" },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.unitCost)}</span>,
    header: "Unit cost",
    key: "unit-cost",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.stockValue)}</span>
    ),
    header: "Stock value",
    key: "value",
  },
];

export function StockValuationTable({ rows }: { rows: StockValuationRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.inventoryItemId} rows={rows} />;
}
