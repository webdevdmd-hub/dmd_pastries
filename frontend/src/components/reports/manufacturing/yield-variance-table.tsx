import type { JSX } from "react";

import { formatNumber, formatPercent } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { YieldVarianceRow } from "@/types/manufacturing-reports";

function varianceBadge(value: number): JSX.Element {
  if (value > 0)
    return <Badge className="border-money/30 bg-money-tint text-money-text">Over produced</Badge>;
  if (value < 0)
    return (
      <Badge className="border-warning/30 bg-warning-tint text-warning-text">Under produced</Badge>
    );
  return <Badge variant="outline">Exact yield</Badge>;
}

export function YieldVarianceTable({ rows }: { rows: YieldVarianceRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Planned</TableHead>
          <TableHead>Produced</TableHead>
          <TableHead>Variance</TableHead>
          <TableHead>Variance %</TableHead>
          <TableHead>Indicator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.batchNumber}>
            <TableCell className="font-semibold">{row.batchNumber || "-"}</TableCell>
            <TableCell>{row.productName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{formatNumber(row.plannedQuantity)}</TableCell>
            <TableCell>{formatNumber(row.producedQuantity)}</TableCell>
            <TableCell>{formatNumber(row.varianceQuantity)}</TableCell>
            <TableCell>{formatPercent(row.variancePercentage)}</TableCell>
            <TableCell>{varianceBadge(row.varianceQuantity)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
