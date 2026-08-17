import type { JSX } from "react";

import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UpcomingOrderRow } from "@/types/bakery-orders-reports";

export function orderStatusBadge(status: string): JSX.Element {
  if (status === "ready" || status === "completed")
    return (
      <Badge className="border-money/30 bg-money-tint text-money-text">
        {status.replaceAll("_", " ")}
      </Badge>
    );
  if (status === "cancelled")
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Cancelled</Badge>;
  if (status === "in_production" || status === "confirmed")
    return (
      <Badge className="border-warning/30 bg-warning-tint text-warning-text">
        {status.replaceAll("_", " ")}
      </Badge>
    );
  return <Badge variant="outline">{status || "New"}</Badge>;
}

export function UpcomingOrdersTable({ rows }: { rows: UpcomingOrderRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Event Date</TableHead>
          <TableHead>Pickup</TableHead>
          <TableHead>Delivery</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.orderId}>
            <TableCell className="font-semibold">{row.orderNumber || "-"}</TableCell>
            <TableCell>{row.customerName || "-"}</TableCell>
            <TableCell>{formatDate(row.eventDate)}</TableCell>
            <TableCell>{row.pickupTime || "-"}</TableCell>
            <TableCell>{row.deliveryTime || "-"}</TableCell>
            <TableCell className="capitalize">{row.orderType || "-"}</TableCell>
            <TableCell>{orderStatusBadge(row.orderStatus)}</TableCell>
            <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
            <TableCell>{formatCurrency(row.balanceAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
