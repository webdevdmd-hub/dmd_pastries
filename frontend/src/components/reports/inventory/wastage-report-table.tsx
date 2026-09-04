import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatDate } from "@/components/reports/sales/sales-report-format";
import type { WastageReportItem } from "@/types/inventory-reports";

const columns: ReportColumn<WastageReportItem>[] = [
  { cell: (row) => row.itemName || "-", header: "Item", key: "item", primary: true },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  {
    cell: (row) => <span className="capitalize">{row.itemType || "-"}</span>,
    header: "Type",
    key: "type",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.quantity}</span>,
    header: "Quantity",
    key: "quantity",
  },
  { align: "right", cell: (row) => row.unitSymbol || "-", header: "Unit", key: "unit" },
  {
    cell: (row) => <span className="block whitespace-normal md:min-w-64">{row.reason || "-"}</span>,
    header: "Reason",
    key: "reason",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.createdAt)}</span>,
    header: "Created",
    key: "created",
  },
];

export function WastageReportTable({ rows }: { rows: WastageReportItem[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row, index) => `${row.itemName}-${row.createdAt}-${String(index)}`}
      rows={rows}
    />
  );
}
