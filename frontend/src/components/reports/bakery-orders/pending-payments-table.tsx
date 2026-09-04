import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { PendingPaymentRow } from "@/types/bakery-orders-reports";

function paymentBadge(status: string): JSX.Element {
  if (status === "paid") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">Paid</Badge>;
  }
  if (status === "partial") {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">Partial</Badge>;
  }

  return (
    <Badge className="border-danger/30 bg-danger-tint text-danger-text">{status || "Unpaid"}</Badge>
  );
}

const columns: ReportColumn<PendingPaymentRow>[] = [
  {
    cell: (row) => row.orderNumber || "-",
    header: "Order",
    key: "order",
    primary: true,
  },
  {
    cell: (row) => row.customerName || "-",
    header: "Customer",
    key: "customer",
    secondary: true,
  },
  {
    cell: (row) => paymentBadge(row.paymentStatus),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.totalAmount)}</span>,
    header: "Total",
    key: "total",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.paidAmount)}</span>,
    header: "Paid",
    key: "paid",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.balanceAmount)}</span>
    ),
    header: "Balance",
    key: "balance",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.eventDate)}</span>,
    header: "Event date",
    key: "event-date",
  },
];

export function PendingPaymentsTable({ rows }: { rows: PendingPaymentRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.orderNumber} rows={rows} />;
}
