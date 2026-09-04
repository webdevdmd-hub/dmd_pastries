import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { OrderStatusRow } from "@/types/bakery-orders-reports";

const columns: ReportColumn<OrderStatusRow>[] = [
  {
    cell: (row) => (
      <span className="capitalize">{row.orderStatus.replaceAll("_", " ") || "-"}</span>
    ),
    header: "Status",
    key: "status",
    primary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.ordersCount)}</span>,
    header: "Orders",
    key: "orders",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.totalOrderValue)}</span>
    ),
    header: "Total value",
    key: "value",
  },
];

export function OrderStatusTable({ rows }: { rows: OrderStatusRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.orderStatus} rows={rows} />;
}
