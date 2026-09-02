import type { JSX } from "react";

import { orderStatusBadge } from "@/components/reports/bakery-orders/upcoming-orders-table";
import { formatDate, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionScheduleRow } from "@/types/bakery-orders-reports";

function productionStatusLabel(status: string): string {
  if (!status) return "Unassigned";
  return status.replaceAll("_", " ");
}

function productionStatusBadge(row: ProductionScheduleRow): JSX.Element {
  const variant =
    row.productionStatus === "not_linked" || !row.productionStatus ? "outline" : "secondary";
  return <Badge variant={variant}>{productionStatusLabel(row.productionStatus)}</Badge>;
}

export function ProductionScheduleTable({ rows }: { rows: ProductionScheduleRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Event Date</TableHead>
          <TableHead>Order Status</TableHead>
          <TableHead>Production</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.orderNumber}-${String(index)}`}>
            <TableCell className="font-semibold">{row.orderNumber || "-"}</TableCell>
            <TableCell>{row.productName || "-"}</TableCell>
            <TableCell>{formatDate(row.eventDate)}</TableCell>
            <TableCell>{orderStatusBadge(row.orderStatus)}</TableCell>
            <TableCell>{productionStatusBadge(row)}</TableCell>
            <TableCell>
              {row.assignedBatchNumber ||
                (row.hasProductionRecord ? (
                  <span className="text-danger-text">Missing assignment</span>
                ) : (
                  <span className="text-muted-foreground">No batch</span>
                ))}
              {row.productionBatchStatus ? (
                <div className="text-xs text-muted-foreground">
                  {row.productionBatchStatus.replaceAll("_", " ")}
                </div>
              ) : null}
            </TableCell>
            <TableCell>{formatNumber(row.quantity)}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell className="whitespace-normal max-w-xs text-sm text-muted-foreground">
              {row.productionNote || "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
