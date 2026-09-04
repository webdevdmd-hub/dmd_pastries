import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import type { DiscountReportItem } from "@/types/sales-reports";

const columns: ReportColumn<DiscountReportItem>[] = [
  {
    cell: (row) => row.saleNumber || "-",
    header: "Sale number",
    key: "sale",
    primary: true,
  },
  {
    cell: (row) => row.cashierName || "-",
    header: "Cashier",
    key: "cashier",
    secondary: true,
  },
  {
    cell: (row) => row.discountType || "-",
    header: "Discount type",
    key: "discount-type",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.discountAmount)}</span>
    ),
    header: "Discount",
    key: "discount",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.saleTotal)}</span>,
    header: "Sale total",
    key: "sale-total",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.soldAt)}</span>,
    header: "Sold at",
    key: "sold-at",
  },
];

export function DiscountSalesTable({ rows }: { rows: DiscountReportItem[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      // Sales reports keep their framed, sticky-headed table on a desktop.
      frameClassName="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-card/85"
      headerClassName="sticky top-0 bg-brand-latte"
      rowKey={(row) => `${row.saleNumber}-${row.soldAt}`}
      rows={rows}
    />
  );
}
