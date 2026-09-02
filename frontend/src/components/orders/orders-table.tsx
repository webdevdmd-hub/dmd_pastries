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

/**
 * Clicking anywhere on a row opens the order's details drawer. The order
 * number is also a real button so the keyboard has a focusable target, and the
 * actions cell stops the click so the kebab does not also open the drawer.
 */
export function OrdersTable({
  canManage,
  onDelete,
  onStatusChange,
  onView,
  orders,
}: {
  canManage: boolean;
  onDelete: (order: BakeryOrder) => void;
  onStatusChange: (order: BakeryOrder, status: OrderStatus) => void;
  onView: (order: BakeryOrder) => void;
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
            className={
              order.orderStatus === "cancelled" ? "cursor-pointer opacity-60" : "cursor-pointer"
            }
            key={order.id}
            onClick={() => onView(order)}
          >
            <TableCell className="font-semibold text-brand-espresso">
              <button
                className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(order);
                }}
                type="button"
              >
                {order.orderNumber}
              </button>
            </TableCell>
            <TableCell>
              <div className="font-medium">{order.customerNameSnapshot}</div>
              <div className="text-xs text-brand-mocha">
                {order.customerPhoneSnapshot ?? "No phone"}
              </div>
            </TableCell>
            <TableCell className="tabular-nums">{formatDate(order.eventDate)}</TableCell>
            <TableCell className="capitalize">{order.orderType}</TableCell>
            <TableCell>
              <OrderStatusBadge status={order.orderStatus} />
            </TableCell>
            <TableCell>
              <OrderPaymentStatusBadge status={order.paymentStatus} />
            </TableCell>
            <TableCell className="tabular-nums">{formatMoney(order.totalAmount)}</TableCell>
            <TableCell className="tabular-nums">{formatMoney(order.balanceAmount)}</TableCell>
            <TableCell className="tabular-nums">{formatDate(order.createdAt)}</TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
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
