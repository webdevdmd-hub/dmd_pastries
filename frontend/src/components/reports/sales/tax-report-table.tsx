import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/components/reports/sales/sales-report-format";
import type { TaxReportRow } from "@/types/sales-reports";

const columns: ReportColumn<TaxReportRow>[] = [
  {
    cell: (row) => row.taxName || "Tax snapshot",
    header: "Tax name",
    key: "tax-name",
    primary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatPercent(row.taxPercentage)}</span>,
    header: "Tax %",
    key: "tax-percent",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.taxableAmount)}</span>,
    header: "Taxable amount",
    key: "taxable",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.taxCollected)}</span>
    ),
    header: "Tax collected",
    key: "collected",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.salesCount)}</span>,
    header: "Sales count",
    key: "sales-count",
  },
];

export function TaxReportTable({ rows }: { rows: TaxReportRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      // Sales reports keep their framed, sticky-headed table on a desktop.
      frameClassName="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-card/85"
      headerClassName="sticky top-0 bg-brand-latte"
      rowKey={(row) => row.taxRateId || row.taxName}
      rows={rows}
    />
  );
}
