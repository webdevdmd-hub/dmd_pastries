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
import type { ProductSalesRow } from "@/types/sales-reports";

export function ProductSalesTable({ rows }: { rows: ProductSalesRow[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-white/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Quantity Sold</TableHead>
            <TableHead>Gross Sales</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead>Net Sales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.productId || row.productName}>
              <TableCell>{row.productName || "Unnamed product"}</TableCell>
              <TableCell>{row.sku || "-"}</TableCell>
              <TableCell>{formatNumber(row.quantitySold)}</TableCell>
              <TableCell>{formatCurrency(row.grossSales)}</TableCell>
              <TableCell>{formatCurrency(row.discountTotal)}</TableCell>
              <TableCell>{formatCurrency(row.taxTotal)}</TableCell>
              <TableCell>{formatCurrency(row.netSales)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
