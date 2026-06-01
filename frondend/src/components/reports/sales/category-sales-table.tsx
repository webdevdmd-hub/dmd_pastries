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
import type { CategorySalesRow } from "@/types/sales-reports";

export function CategorySalesTable({ rows }: { rows: CategorySalesRow[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-white/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Quantity Sold</TableHead>
            <TableHead>Sales Count</TableHead>
            <TableHead>Gross Sales</TableHead>
            <TableHead>Net Sales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.categoryId || row.categoryName}>
              <TableCell>{row.categoryName || "Uncategorized"}</TableCell>
              <TableCell>{formatNumber(row.quantitySold)}</TableCell>
              <TableCell>{formatNumber(row.salesCount)}</TableCell>
              <TableCell>{formatCurrency(row.grossSales)}</TableCell>
              <TableCell>{formatCurrency(row.netSales)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
