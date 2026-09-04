import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { ReconciliationRow } from "@/types/financial-reports";

function directionBadge(direction: string): JSX.Element {
  if (direction === "in") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">In</Badge>;
  }

  return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Out</Badge>;
}

const columns: ReportColumn<ReconciliationRow>[] = [
  {
    cell: (row) => row.sourceNumber || "-",
    header: "Reference",
    key: "reference",
    primary: true,
  },
  {
    cell: (row) => row.branchName || "-",
    header: "Branch",
    key: "branch",
    secondary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.transactionAt)}</span>,
    header: "Date",
    key: "date",
  },
  {
    cell: (row) => row.transactionType || "-",
    header: "Type",
    key: "type",
  },
  {
    cell: (row) => row.sourceType || "-",
    header: "Source",
    key: "source",
  },
  {
    cell: (row) => row.paymentMethodName || "-",
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
    cell: (row) => directionBadge(row.direction),
    header: "Direction",
    key: "direction",
    unlabelledOnCard: true,
  },
  {
    cell: (row) => row.status || "-",
    header: "Status",
    key: "status",
  },
  {
    cell: (row) => row.createdByUserName || "-",
    header: "Created by",
    key: "created-by",
  },
];

export function ReconciliationReportTable({ rows }: { rows: ReconciliationRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row) =>
        row.transactionId || `${row.sourceType}-${row.sourceNumber}-${row.transactionAt}`
      }
      rows={rows}
    />
  );
}
