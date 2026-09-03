"use client";

import type { JSX } from "react";

import { PurchaseOrderActionsMenu } from "@/components/purchasing/purchase-order-actions-menu";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import {
  formatPurchaseOrderCurrency,
  nextStepForOrder,
  orderSubline,
  type PurchaseOrdersListProps,
} from "@/components/purchasing/purchase-orders-table";
import { Card } from "@/components/ui/card";
import { formatDateOnly } from "@/lib/format/date";

/**
 * Purchase orders as cards, for phones: an eight-column ledger has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function PurchaseOrdersCardGrid({
  onView,
  orders,
  ...actions
}: PurchaseOrdersListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((order) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={order.id}
          onClick={() => onView(order)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(order);
              }}
              type="button"
            >
              <span className="truncate font-mono font-medium">{order.purchaseOrderNumber}</span>
              <span className="truncate text-meta text-foreground-muted">
                {orderSubline(order)}
              </span>
            </button>
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <PurchaseOrderStatusBadge status={order.status} />
              <PurchaseOrderActionsMenu {...actions} order={order} />
            </div>
          </div>

          <div className="grid gap-1 px-4 py-3 text-cell">
            <span className="font-medium">{order.supplierName}</span>
            <span className="text-foreground-muted">{nextStepForOrder(order, actions)}</span>
          </div>

          <div className="grid grid-cols-3 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-3 py-3">
              <p className="text-meta text-foreground-muted">Ordered</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatDateOnly(order.orderDate)}
              </p>
            </div>
            <div className="min-w-0 border-r border-workspace-border px-3 py-3">
              <p className="text-meta text-foreground-muted">Expected</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatDateOnly(order.expectedDeliveryDate)}
              </p>
            </div>
            <div className="min-w-0 px-3 py-3">
              <p className="text-meta text-foreground-muted">Total</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatPurchaseOrderCurrency(order.totalAmount)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
