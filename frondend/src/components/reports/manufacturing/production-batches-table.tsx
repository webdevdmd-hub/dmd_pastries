import type { JSX } from "react";

import {
  formatDate,
  formatNumber,
  formatPercent,
} from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionBatchReportRow } from "@/types/manufacturing-reports";

function statusBadge(status: string): JSX.Element {
  if (status === "completed")
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Completed</Badge>;
  if (status === "cancelled")
    return <Badge className="border-red-200 bg-red-50 text-red-800">Cancelled</Badge>;
  if (status === "in_progress" || status === "partially_completed")
    return (
      <Badge className="border-amber-200 bg-amber-50 text-amber-800">
        {status.replaceAll("_", " ")}
      </Badge>
    );
  return <Badge variant="outline">{status || "Draft"}</Badge>;
}

export function ProductionBatchesTable({
  rows,
}: {
  rows: ProductionBatchReportRow[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Recipe</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Planned</TableHead>
          <TableHead>Produced</TableHead>
          <TableHead>Variance</TableHead>
          <TableHead>Efficiency</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>End</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.batchId}>
            <TableCell className="font-semibold">{row.batchNumber || "-"}</TableCell>
            <TableCell>{row.productName || "-"}</TableCell>
            <TableCell>{row.recipeName || "-"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{formatNumber(row.plannedQuantity)}</TableCell>
            <TableCell>{formatNumber(row.producedQuantity)}</TableCell>
            <TableCell>{formatNumber(row.yieldVariance)}</TableCell>
            <TableCell>{formatPercent(row.yieldEfficiencyPercentage)}</TableCell>
            <TableCell>{statusBadge(row.status)}</TableCell>
            <TableCell>{formatDate(row.startTime)}</TableCell>
            <TableCell>{formatDate(row.endTime)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
