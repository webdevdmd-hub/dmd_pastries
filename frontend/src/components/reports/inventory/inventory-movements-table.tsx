import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatDate } from "@/components/reports/sales/sales-report-format";
import type { InventoryMovementReportRow } from "@/types/inventory-reports";

function movementTypeLabel(value: string): string {
  if (value === "transfer") {
    return "Stock transfer";
  }

  return value.replaceAll("_", " ");
}

const columns: ReportColumn<InventoryMovementReportRow>[] = [
  { cell: (row) => row.itemName || "-", header: "Item", key: "item", primary: true },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
    header: "Date",
    key: "date",
  },
  {
    cell: (row) => <span className="capitalize">{movementTypeLabel(row.movementType)}</span>,
    header: "Movement",
    key: "movement",
  },
  {
    cell: (row) => <span className="capitalize">{row.movementDirection || "-"}</span>,
    header: "Direction",
    key: "direction",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.quantity}</span>,
    header: "Quantity",
    key: "quantity",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.beforeQuantity}</span>,
    header: "Before",
    key: "before",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.afterQuantity}</span>,
    header: "After",
    key: "after",
  },
  { align: "right", cell: (row) => row.unitSymbol || "-", header: "Unit", key: "unit" },
  { cell: (row) => row.referenceNumber || "-", header: "Reference", key: "reference" },
  { cell: (row) => row.createdBy || "-", header: "Created by", key: "created-by" },
];

export function InventoryMovementsTable({
  rows,
}: {
  rows: InventoryMovementReportRow[];
}): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.movementId} rows={rows} />;
}
