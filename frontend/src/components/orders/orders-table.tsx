import type { JSX } from "react";

import { OrderActionsMenu } from "@/components/orders/order-actions-menu";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly } from "@/lib/utils/date-only";
import type { BakeryOrder, OrderStatus } from "@/types/orders";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return formatDateOnly(value, "Not set");
}

export function OrdersTable({
  canManage,
  onDelete,
  onStatusChange,
  orders,
}: {
  canManage: boolean;
  onDelete: (order: BakeryOrder) => void;
  onStatusChange: (order: BakeryOrder, status: OrderStatus) => void;
  orders: BakeryOrder[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Event Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            className={order.orderStatus === "cancelled" ? "opacity-60" : ""}
            key={order.id}
          >
            <TableCell className="font-semibold text-brand-espresso">{order.orderNumber}</TableCell>
            <TableCell>
              <div className="font-medium">{order.customerNameSnapshot}</div>
              <div className="text-xs text-brand-mocha">
                {order.customerPhoneSnapshot ?? "No phone"}
              </div>
            </TableCell>
            <TableCell>{formatDate(order.eventDate)}</TableCell>
            <TableCell className="capitalize">{order.orderType}</TableCell>
            <TableCell>
              <OrderStatusBadge status={order.orderStatus} />
            </TableCell>
            <TableCell>
              <OrderPaymentStatusBadge status={order.paymentStatus} />
            </TableCell>
            <TableCell>{formatMoney(order.totalAmount)}</TableCell>
            <TableCell>{formatMoney(order.balanceAmount)}</TableCell>
            <TableCell>{formatDate(order.createdAt)}</TableCell>
            <TableCell className="text-right">
              <OrderActionsMenu
                canManage={canManage}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                order={order}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
