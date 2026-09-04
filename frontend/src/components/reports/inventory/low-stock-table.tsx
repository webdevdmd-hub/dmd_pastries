import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import type { LowStockRow } from "@/types/inventory-reports";

const columns: ReportColumn<LowStockRow>[] = [
  { cell: (row) => row.itemName || "-", header: "Item", key: "item", primary: true },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.availableQuantity}</span>,
    header: "Available",
    key: "available",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.reorderLevel}</span>,
    header: <ReorderLevelHeader />,
    key: "reorder",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.shortageQuantity}</span>,
    header: "Shortage",
    key: "shortage",
  },
  { align: "right", cell: (row) => row.unitSymbol || "-", header: "Unit", key: "unit" },
];

export function LowStockTable({ rows }: { rows: LowStockRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.inventoryItemId} rows={rows} />;
}
