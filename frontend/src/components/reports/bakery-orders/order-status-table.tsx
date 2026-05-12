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
import type { OrderStatusRow } from "@/types/bakery-orders-reports";

export function OrderStatusTable({ rows }: { rows: OrderStatusRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Orders Count</TableHead>
          <TableHead>Total Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.orderStatus}>
            <TableCell className="font-semibold capitalize">
              {row.orderStatus.replaceAll("_", " ") || "-"}
            </TableCell>
            <TableCell>{formatNumber(row.ordersCount)}</TableCell>
            <TableCell>{formatCurrency(row.totalOrderValue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
