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
import type { BranchSalesRow } from "@/types/sales-reports";

export function BranchSalesTable({ rows }: { rows: BranchSalesRow[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-white/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead>Sales Count</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Gross Sales</TableHead>
            <TableHead>Net Sales</TableHead>
            <TableHead>Tax Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.branchId || row.branchName}>
              <TableCell>{row.branchName || "Unknown branch"}</TableCell>
              <TableCell>{formatNumber(row.salesCount)}</TableCell>
              <TableCell>{formatNumber(row.itemsSold)}</TableCell>
              <TableCell>{formatCurrency(row.grossSales)}</TableCell>
              <TableCell>{formatCurrency(row.netSales)}</TableCell>
              <TableCell>{formatCurrency(row.taxTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
