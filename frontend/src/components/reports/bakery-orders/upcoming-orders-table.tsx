import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { UpcomingOrderRow } from "@/types/bakery-orders-reports";

export function orderStatusBadge(status: string): JSX.Element {
  if (status === "ready" || status === "completed") {
    return (
      <Badge className="border-money/30 bg-money-tint text-money-text">
        {status.replaceAll("_", " ")}
      </Badge>
    );
  }
  if (status === "cancelled") {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Cancelled</Badge>;
  }
  if (status === "in_production" || status === "confirmed") {
    return (
      <Badge className="border-warning/30 bg-warning-tint text-warning-text">
        {status.replaceAll("_", " ")}
      </Badge>
    );
  }

  return <Badge variant="outline">{status || "New"}</Badge>;
}

const columns: ReportColumn<UpcomingOrderRow>[] = [
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
    cell: (row) => orderStatusBadge(row.orderStatus),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.eventDate)}</span>,
    header: "Event date",
    key: "event-date",
  },
  {
    align: "right",
    cell: (row) => row.pickupTime || "-",
    header: "Pickup",
    key: "pickup",
  },
  {
    align: "right",
    cell: (row) => row.deliveryTime || "-",
    header: "Delivery",
    key: "delivery",
  },
  {
    cell: (row) => <span className="capitalize">{row.orderType || "-"}</span>,
    header: "Type",
    key: "type",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.totalAmount)}</span>,
    header: "Total",
    key: "total",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.balanceAmount)}</span>
    ),
    header: "Balance",
    key: "balance",
  },
];

export function UpcomingOrdersTable({ rows }: { rows: UpcomingOrderRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.orderId} rows={rows} />;
}
