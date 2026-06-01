import type { JSX } from "react";

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

export function ProductionScheduleTable({ rows }: { rows: ProductionScheduleRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Event Date</TableHead>
          <TableHead>Production</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Branch</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.orderNumber}-${String(index)}`}>
            <TableCell className="font-semibold">{row.orderNumber || "-"}</TableCell>
            <TableCell>{row.productName || "-"}</TableCell>
            <TableCell>{formatDate(row.eventDate)}</TableCell>
            <TableCell>
              <Badge variant={row.productionStatus ? "secondary" : "outline"}>
                {row.productionStatus || "Unassigned"}
              </Badge>
            </TableCell>
            <TableCell>
              {row.assignedBatchNumber || <span className="text-red-700">Missing assignment</span>}
            </TableCell>
            <TableCell>{formatNumber(row.quantity)}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
