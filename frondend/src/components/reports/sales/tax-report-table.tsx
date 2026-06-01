import type { JSX } from "react";

import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/components/reports/sales/sales-report-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaxReportRow } from "@/types/sales-reports";

export function TaxReportTable({ rows }: { rows: TaxReportRow[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-cappuccino bg-white/85">
      <Table>
        <TableHeader className="sticky top-0 bg-brand-latte">
          <TableRow>
            <TableHead>Tax Name</TableHead>
            <TableHead>Tax %</TableHead>
            <TableHead>Taxable Amount</TableHead>
            <TableHead>Tax Collected</TableHead>
            <TableHead>Sales Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.taxRateId || row.taxName}>
              <TableCell>{row.taxName || "Tax snapshot"}</TableCell>
              <TableCell>{formatPercent(row.taxPercentage)}</TableCell>
              <TableCell>{formatCurrency(row.taxableAmount)}</TableCell>
              <TableCell>{formatCurrency(row.taxCollected)}</TableCell>
              <TableCell>{formatNumber(row.salesCount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
