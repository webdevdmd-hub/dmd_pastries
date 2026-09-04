import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { RefundReportRow } from "@/types/financial-reports";

function refundBadge(status: string): JSX.Element {
  if (status === "completed") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">Completed</Badge>;
  }
  if (status === "pending") {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">Pending</Badge>;
  }

  return (
    <Badge className="border-danger/30 bg-danger-tint text-danger-text">{status || "Failed"}</Badge>
  );
}

const columns: ReportColumn<RefundReportRow>[] = [
  {
    cell: (row) => row.sourceNumber || "-",
    header: "Source number",
    key: "source",
    primary: true,
  },
  {
    cell: (row) => row.branchName || "-",
    header: "Branch",
    key: "branch",
    secondary: true,
  },
  {
    cell: (row) => row.sourceType || "-",
    header: "Source type",
    key: "source-type",
  },
  {
    cell: (row) => row.paymentMethodName || "-",
    header: "Payment method",
    key: "method",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.refundAmount)}</span>
    ),
    header: "Refund amount",
    key: "amount",
  },
  {
    cell: (row) => (
      <span className="block whitespace-normal md:min-w-64">{row.refundReason || "-"}</span>
    ),
    header: "Reason",
    key: "reason",
  },
  {
    cell: (row) => refundBadge(row.refundStatus),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
  {
    cell: (row) => row.createdByUserName || "-",
    header: "Refunded by",
    key: "refunded-by",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.refundedAt)}</span>,
    header: "Refunded at",
    key: "refunded-at",
  },
];

export function RefundsReportTable({ rows }: { rows: RefundReportRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row) => row.refundId || `${row.sourceNumber}-${row.refundedAt}`}
      rows={rows}
    />
  );
}
