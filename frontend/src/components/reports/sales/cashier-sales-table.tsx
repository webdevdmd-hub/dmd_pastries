import type { JSX } from "react";

import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashierSalesRow } from "@/types/sales-reports";

export function CashierSalesTable({ rows }: { rows: CashierSalesRow[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-card/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Cashier</TableHead>
            <TableHead>Sales Count</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Gross Sales</TableHead>
            <TableHead>Net Sales</TableHead>
            <TableHead>Refund Count</TableHead>
            <TableHead>Void Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.cashierUserId || row.cashierName}>
              <TableCell>{row.cashierName || "Unknown cashier"}</TableCell>
              <TableCell>{formatNumber(row.salesCount)}</TableCell>
              <TableCell>{formatNumber(row.itemsSold)}</TableCell>
              <TableCell>{formatCurrency(row.grossSales)}</TableCell>
              <TableCell>{formatCurrency(row.netSales)}</TableCell>
              <TableCell>{formatNumber(row.refundCount)}</TableCell>
              <TableCell>{formatNumber(row.voidCount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
