import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { ProductSalesRow } from "@/types/sales-reports";

const columns: ReportColumn<ProductSalesRow>[] = [
  {
    cell: (row) => row.productName || "Unnamed product",
    header: "Product",
    key: "product",
    primary: true,
  },
  {
    cell: (row) => row.sku || "-",
    header: "SKU",
    key: "sku",
    secondary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.quantitySold)}</span>,
    header: "Quantity sold",
    key: "quantity",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.grossSales)}</span>,
    header: "Gross sales",
    key: "gross",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.discountTotal)}</span>,
    header: "Discount",
    key: "discount",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.taxTotal)}</span>,
    header: "Tax",
    key: "tax",
  },
  {
    align: "right",
    cell: (row) => <span className="font-medium tabular-nums">{formatCurrency(row.netSales)}</span>,
    header: "Net sales",
    key: "net",
  },
];

export function ProductSalesTable({ rows }: { rows: ProductSalesRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      // Sales reports keep their framed, sticky-headed table on a desktop.
      frameClassName="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-card/85"
      headerClassName="sticky top-0 bg-brand-latte"
      rowKey={(row) => row.productId || row.productName}
      rows={rows}
    />
  );
}
