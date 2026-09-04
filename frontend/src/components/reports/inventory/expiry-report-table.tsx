import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { ExpiryReportRow } from "@/types/inventory-reports";

function expiryBadge(state: string, label: string): JSX.Element {
  if (state === "expired" || state === "expires_today") {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">{label}</Badge>;
  }

  return <Badge className="border-warning/30 bg-warning-tint text-warning-text">{label}</Badge>;
}

const columns: ReportColumn<ExpiryReportRow>[] = [
  { cell: (row) => row.itemName || "-", header: "Item", key: "item", primary: true },
  { cell: (row) => row.branchName || "-", header: "Branch", key: "branch", secondary: true },
  { cell: (row) => row.batchNumber || "-", header: "Batch", key: "batch" },
  {
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">
        {row.quantity} {row.unitSymbol}
      </span>
    ),
    header: "Quantity",
    key: "quantity",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.receivedDate)}</span>,
    header: "Received",
    key: "received",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.expiryDate)}</span>,
    header: "Expiry",
    key: "expiry",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.daysRemaining}</span>,
    header: "Days left",
    key: "days-left",
  },
  {
    cell: (row) => expiryBadge(row.expiryState, row.expiryStateLabel),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
];

export function ExpiryReportTable({ rows }: { rows: ExpiryReportRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.batchId} rows={rows} />;
}
