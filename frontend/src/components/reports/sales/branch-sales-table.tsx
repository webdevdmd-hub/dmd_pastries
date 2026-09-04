import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { BranchSalesRow } from "@/types/sales-reports";

const columns: ReportColumn<BranchSalesRow>[] = [
  {
    cell: (row) => row.branchName || "Unknown branch",
    header: "Branch",
    key: "branch",
    primary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.salesCount)}</span>,
    header: "Sales count",
    key: "sales-count",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.itemsSold)}</span>,
    header: "Items sold",
    key: "items-sold",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.grossSales)}</span>,
    header: "Gross sales",
    key: "gross",
  },
  {
    align: "right",
    cell: (row) => <span className="font-medium tabular-nums">{formatCurrency(row.netSales)}</span>,
    header: "Net sales",
    key: "net",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.taxTotal)}</span>,
    header: "Tax total",
    key: "tax",
  },
];

export function BranchSalesTable({ rows }: { rows: BranchSalesRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      // Sales reports keep their framed, sticky-headed table on a desktop.
      frameClassName="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-card/85"
      headerClassName="sticky top-0 bg-brand-latte"
      rowKey={(row) => row.branchId || row.branchName}
      rows={rows}
    />
  );
}
