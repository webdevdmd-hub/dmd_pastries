import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import type { CurrentStockRow } from "@/types/inventory-reports";

function stockBadge(row: CurrentStockRow): JSX.Element {
  if (row.isOutOfStock) {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Out of stock</Badge>;
  }
  if (row.isLowStock) {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">Low stock</Badge>;
  }

  return <Badge className="border-money/30 bg-money-tint text-money-text">Normal</Badge>;
}

const columns: ReportColumn<CurrentStockRow>[] = [
  {
    cell: (row) => row.itemName || "-",
    header: "Item",
    key: "item",
    primary: true,
  },
  {
    cell: (row) => row.itemCode || "-",
    header: "Code",
    key: "code",
    secondary: true,
  },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch" },
  {
    cell: (row) => <span className="capitalize">{row.itemType || "-"}</span>,
    header: "Type",
    key: "type",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.currentQuantity}</span>,
    header: "Current",
    key: "current",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.reservedQuantity}</span>,
    header: "Reserved",
    key: "reserved",
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
  { cell: (row) => row.unitSymbol || "-", header: "Unit", key: "unit" },
  { cell: (row) => stockBadge(row), header: "Stock", key: "stock", unlabelledOnCard: true },
  {
    cell: (row) => <span className="capitalize">{row.status || "-"}</span>,
    header: "Status",
    key: "status",
  },
];

export function CurrentStockTable({ rows }: { rows: CurrentStockRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.inventoryItemId} rows={rows} />;
}
