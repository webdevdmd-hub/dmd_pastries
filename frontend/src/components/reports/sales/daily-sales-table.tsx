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
import type { DailySalesRow } from "@/types/sales-reports";

export function DailySalesTable({ rows }: { rows: DailySalesRow[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-card/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Gross Sales</TableHead>
            <TableHead>Net Sales</TableHead>
            <TableHead>Sales Count</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.date}>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>{formatCurrency(row.grossSales)}</TableCell>
              <TableCell>{formatCurrency(row.netSales)}</TableCell>
              <TableCell>{formatNumber(row.salesCount)}</TableCell>
              <TableCell>{formatNumber(row.itemsSold)}</TableCell>
              <TableCell>{formatCurrency(row.discountTotal)}</TableCell>
              <TableCell>{formatCurrency(row.taxTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
