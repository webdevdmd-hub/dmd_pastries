import type { JSX } from "react";

import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DiscountReportItem } from "@/types/sales-reports";

export function DiscountSalesTable({ rows }: { rows: DiscountReportItem[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-white/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Sale Number</TableHead>
            <TableHead>Cashier</TableHead>
            <TableHead>Discount Type</TableHead>
            <TableHead>Discount Amount</TableHead>
            <TableHead>Sale Total</TableHead>
            <TableHead>Sold At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.saleNumber}-${row.soldAt}`}>
              <TableCell>{row.saleNumber || "-"}</TableCell>
              <TableCell>{row.cashierName || "-"}</TableCell>
              <TableCell>{row.discountType || "-"}</TableCell>
              <TableCell>{formatCurrency(row.discountAmount)}</TableCell>
              <TableCell>{formatCurrency(row.saleTotal)}</TableCell>
              <TableCell>{formatDate(row.soldAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
