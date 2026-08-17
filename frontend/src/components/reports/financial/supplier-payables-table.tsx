import type { JSX } from "react";

import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupplierPayableRow } from "@/types/financial-reports";

export function SupplierPayablesTable({ rows }: { rows: SupplierPayableRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Supplier</TableHead>
          <TableHead>Invoice Count</TableHead>
          <TableHead>Invoice Amount</TableHead>
          <TableHead>Paid Amount</TableHead>
          <TableHead>Payable Balance</TableHead>
          <TableHead>Oldest Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.supplierId || row.supplierName}>
            <TableCell className="font-semibold">{row.supplierName || "-"}</TableCell>
            <TableCell>{formatNumber(row.invoiceCount)}</TableCell>
            <TableCell>{formatCurrency(row.totalInvoiceAmount)}</TableCell>
            <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
            <TableCell className={row.payableBalance > 0 ? "font-semibold text-danger-text" : ""}>
              {formatCurrency(row.payableBalance)}
            </TableCell>
            <TableCell>{formatDate(row.oldestDueDate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
