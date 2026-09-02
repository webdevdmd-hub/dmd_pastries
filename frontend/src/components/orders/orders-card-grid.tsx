import { CalendarDays, Clock, MapPin, Phone, Truck, UserRound } from "lucide-react";
import type { JSX } from "react";

import { OrderActionsMenu } from "@/components/orders/order-actions-menu";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card } from "@/components/ui/card";
import { formatDateOnly } from "@/lib/utils/date-only";
import type { BakeryOrder, OrderStatus } from "@/types/orders";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return formatDateOnly(value, "Not set");
}

function formatOrderType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Clicking anywhere on a card opens the order's details drawer. The order
 * number is also a real button so the keyboard has a focusable target, and the
 * kebab stops the click so it does not also open the drawer.
 */
export function OrdersCardGrid({
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <Card
          className={
            order.orderStatus === "cancelled"
              ? "cursor-pointer overflow-hidden opacity-60 transition-shadow duration-fast ease-out hover:shadow-sm"
              : "cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          }
          key={order.id}
          onClick={() => onView(order)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="min-w-0">
              <button
                className="block max-w-full truncate rounded-sm text-left text-base font-semibold text-brand-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(order);
                }}
                type="button"
              >
                {order.orderNumber}
              </button>
              <p className="mt-0.5 truncate text-xs text-workspace-muted">
                Created {formatDate(order.createdAt)}
              </p>
            </div>
            <div onClick={(event) => event.stopPropagation()}>
              <OrderActionsMenu
                canManage={canManage}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                order={order}
              />
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.orderStatus} />
              <OrderPaymentStatusBadge status={order.paymentStatus} />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-workspace-muted" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-espresso">
                    {order.customerNameSnapshot || "Walk-in customer"}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-workspace-muted">
                    <Phone className="h-3 w-3" />
                    {order.customerPhoneSnapshot ?? "No phone"}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-brand-espresso sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl bg-brand-latte/60 px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-workspace-muted" />
                  <span>{formatDate(order.eventDate)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-brand-latte/60 px-3 py-2">
                  <Truck className="h-4 w-4 text-workspace-muted" />
                  <span>{formatOrderType(order.orderType)}</span>
                </div>
              </div>

              {order.pickupTime || order.deliveryTime ? (
                <div className="flex items-center gap-2 text-xs text-workspace-muted">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{order.pickupTime ?? order.deliveryTime}</span>
                </div>
              ) : null}

              {order.deliveryAddress ? (
                <div className="flex items-start gap-2 text-xs text-workspace-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2">{order.deliveryAddress}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="border-r border-workspace-border px-4 py-3">
              <p className="text-xs text-workspace-muted">Total</p>
              <p className="mt-1 text-sm font-semibold text-brand-espresso">
                {formatMoney(order.totalAmount)}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-workspace-muted">Balance</p>
              <p className="mt-1 text-sm font-semibold text-brand-espresso">
                {formatMoney(order.balanceAmount)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
