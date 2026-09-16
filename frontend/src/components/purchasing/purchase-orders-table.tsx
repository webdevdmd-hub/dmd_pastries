"use client";

import type { JSX } from "react";

import {
  type PurchaseOrderActionHandlers,
  PurchaseOrderActionsMenu,
} from "@/components/purchasing/purchase-order-actions-menu";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly } from "@/lib/format/date";
import { nextStepForOrder } from "@/lib/purchasing/order-next-step";
import type { PurchaseOrder } from "@/types/purchasing";

export type PurchaseOrdersListProps = PurchaseOrderActionHandlers & {
  /** Opens the order's details; the whole row is the target. */
  onView: (order: PurchaseOrder) => void;
  orders: PurchaseOrder[];
};

export function formatPurchaseOrderCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

/**
 * Branch and who raised it are how you recognise a row once you have found it,
 * not how you find it. They ride under the number they belong to.
 */
export function orderSubline(order: PurchaseOrder): string {
  return [order.branchName, order.createdByUserName].filter(Boolean).join(" · ");
}

export { nextStepForOrder } from "@/lib/purchasing/order-next-step";

export function PurchaseOrdersTable({
  onView,
  orders,
  ...actions
}: PurchaseOrdersListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PO number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Order date</TableHead>
          <TableHead>Expected delivery</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Next step</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          // The row opens the drawer; the number is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={order.id} onClick={() => onView(order)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(order);
                }}
                type="button"
              >
                <span className="font-mono font-medium">{order.purchaseOrderNumber}</span>
                <span className="text-meta text-foreground-muted">{orderSubline(order)}</span>
              </button>
            </TableCell>
            <TableCell>{order.supplierName}</TableCell>
            <TableCell className="tabular-nums">{formatDateOnly(order.orderDate)}</TableCell>
            <TableCell className="tabular-nums">
              {formatDateOnly(order.expectedDeliveryDate)}
            </TableCell>
            <TableCell>
              <PurchaseOrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatPurchaseOrderCurrency(order.totalAmount)}
            </TableCell>
            <TableCell className="text-foreground-muted">
              {nextStepForOrder(order, actions)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <PurchaseOrderActionsMenu {...actions} order={order} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
