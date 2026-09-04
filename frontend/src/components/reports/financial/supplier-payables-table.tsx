import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/components/reports/sales/sales-report-format";
import type { SupplierPayableRow } from "@/types/financial-reports";

const columns: ReportColumn<SupplierPayableRow>[] = [
  {
    cell: (row) => row.supplierName || "-",
    header: "Supplier",
    key: "supplier",
    primary: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.invoiceCount)}</span>,
    header: "Invoices",
    key: "invoice-count",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.totalInvoiceAmount)}</span>,
    header: "Invoice amount",
    key: "invoice-amount",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatCurrency(row.paidAmount)}</span>,
    header: "Paid amount",
    key: "paid",
  },
  {
    align: "right",
    cell: (row) => (
      <span
        className={
          row.payableBalance > 0 ? "font-medium tabular-nums text-danger-text" : "tabular-nums"
        }
      >
        {formatCurrency(row.payableBalance)}
      </span>
    ),
    header: "Payable balance",
    key: "balance",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.oldestDueDate)}</span>,
    header: "Oldest due date",
    key: "oldest-due",
  },
];

export function SupplierPayablesTable({ rows }: { rows: SupplierPayableRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row) => row.supplierId || row.supplierName}
      rows={rows}
    />
  );
}
