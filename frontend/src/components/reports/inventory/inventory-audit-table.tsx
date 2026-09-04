import type { JSX } from "react";

import { AuditStatusBadge } from "@/components/reports/inventory/audit-status-badge";
import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import type { InventoryAuditRow } from "@/types/inventory-reports";

const columns: ReportColumn<InventoryAuditRow>[] = [
  {
    cell: (row) => (
      <>
        <div>{row.itemName || "-"}</div>
        {/* The whole point of this report is the unbalanced row, so it says
            what to do about it rather than only flagging itself. */}
        {row.isBalanced ? null : (
          <div className="text-meta font-normal text-danger-text">
            Investigate stock movements or post a correction adjustment.
          </div>
        )}
      </>
    ),
    header: "Item",
    key: "item",
    primary: true,
  },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.currentQuantity}</span>,
    header: "Current qty",
    key: "current",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.calculatedQuantityFromMovements}</span>,
    header: "Ledger qty",
    key: "ledger",
  },
  {
    align: "right",
    cell: (row) => (
      <span className={`tabular-nums ${row.isBalanced ? "" : "font-medium text-danger-text"}`}>
        {row.difference}
      </span>
    ),
    header: "Difference",
    key: "difference",
  },
  {
    cell: (row) => <AuditStatusBadge isBalanced={row.isBalanced} />,
    header: "Audit status",
    key: "status",
    unlabelledOnCard: true,
  },
];

export function InventoryAuditTable({ rows }: { rows: InventoryAuditRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.inventoryItemId} rows={rows} />;
}
