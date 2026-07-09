import { CalendarDays, Clock, MapPin, Phone, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { OrderActionsMenu } from "@/components/orders/order-actions-menu";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
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

export function OrdersCardGrid({
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <Card
          className={
            order.orderStatus === "cancelled" ? "overflow-hidden opacity-60" : "overflow-hidden"
          }
          key={order.id}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="min-w-0">
              <Link
                className="block truncate text-base font-semibold text-brand-espresso underline-offset-4 hover:underline"
                href={`${ROUTES.orders}/${order.id}`}
              >
                {order.orderNumber}
              </Link>
              <p className="mt-0.5 truncate text-xs text-workspace-muted">
                Created {formatDate(order.createdAt)}
              </p>
            </div>
            <OrderActionsMenu
              canManage={canManage}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              order={order}
            />
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
              <p className="text-xs uppercase tracking-[0.18em] text-workspace-muted">Total</p>
              <p className="mt-1 text-sm font-semibold text-brand-espresso">
                {formatMoney(order.totalAmount)}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-workspace-muted">Balance</p>
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
