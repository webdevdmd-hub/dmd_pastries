import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { PaymentsReportRow } from "@/types/financial-reports";

function statusBadge(status: string): JSX.Element {
  if (status === "completed" || status === "paid") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">{status}</Badge>;
  }
  if (status === "pending" || status === "partial") {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">{status}</Badge>;
  }

  return (
    <Badge className="border-danger/30 bg-danger-tint text-danger-text">
      {status || "unknown"}
    </Badge>
  );
}

const columns: ReportColumn<PaymentsReportRow>[] = [
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
    cell: (row) => row.paymentMethodName || row.paymentMethodType || "-",
    header: "Payment method",
    key: "method",
  },
  {
    align: "right",
    cell: (row) => <span className="font-medium tabular-nums">{formatCurrency(row.amount)}</span>,
    header: "Amount",
    key: "amount",
  },
  {
    cell: (row) => statusBadge(row.status),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
  {
    cell: (row) => row.referenceNumber || "-",
    header: "Reference",
    key: "reference",
  },
  {
    cell: (row) => row.paidByUserName || "-",
    header: "Paid by",
    key: "paid-by",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.paidAt)}</span>,
    header: "Paid at",
    key: "paid-at",
  },
];

export function PaymentsReportTable({ rows }: { rows: PaymentsReportRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row) => row.paymentId || `${row.sourceNumber}-${row.paidAt}`}
      rows={rows}
    />
  );
}
