"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import { OrderHeader } from "@/components/orders/order-header";
import { OrderItemConversionActions } from "@/components/orders/order-item-conversion-actions";
import { OrderPackagingSection } from "@/components/orders/order-packaging-section";
import { OrderPaymentSection } from "@/components/orders/order-payment-section";
import { OrderProductionSection } from "@/components/orders/order-production-section";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useOrder, useUpdateOrderStatus } from "@/hooks/use-orders";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { formatDateOnly } from "@/lib/utils/date-only";
import type { OrderStatus } from "@/types/orders";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

const transitions: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "delivered",
  "completed",
  "cancelled",
];

export function OrderDetailsPageClient({ orderId }: { orderId: string }): JSX.Element {
  const { hasAnyPermission, hasPermission } = usePermission();
  // TODO: Remove POS fallback after orders.* permissions are seeded for every tenant.
  const canView = hasAnyPermission([PERMISSIONS.ordersView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.ordersEdit,
    PERMISSIONS.ordersStatusUpdate,
    PERMISSIONS.ordersPaymentsManage,
    PERMISSIONS.ordersProductionAssign,
    PERMISSIONS.ordersPackagingManage,
    PERMISSIONS.posSell,
  ]);
  const canManageOrderCatalogLinks = hasAnyPermission([
    PERMISSIONS.ordersEdit,
    PERMISSIONS.posSell,
  ]);
  const canConvertCustomItemToProduct =
    canManageOrderCatalogLinks && hasPermission(PERMISSIONS.productsCreate);
  const canConvertCustomItemToVariant =
    canManageOrderCatalogLinks && hasPermission(PERMISSIONS.productsVariantsManage);
  const orderQuery = useOrder(orderId, canView);
  const statusMutation = useUpdateOrderStatus();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (orderQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-brand-mocha">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading order...
      </div>
    );
  }

  if (isPermissionDenied(orderQuery.error)) {
    return <AccessDeniedCard />;
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <OrdersErrorState
        description={getErrorMessage(orderQuery.error)}
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const order = orderQuery.data;

  return (
    <main className="min-h-screen bg-brand-latte px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <OrderHeader canManage={canManage} isSaving={false} order={order} />
        <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-brand-espresso">
                {order.customerNameSnapshot || "Walk-in customer"}
              </h2>
              <p className="text-brand-mocha">{order.customerPhoneSnapshot ?? "No phone number"}</p>
              <p className="mt-2 text-sm text-brand-mocha">
                {order.orderType} - Event {formatDateOnly(order.eventDate, "Not set")}
              </p>
            </div>
            <div className="grid gap-2 text-right">
              <OrderStatusBadge status={order.orderStatus} />
              <p className="text-3xl font-bold text-brand-espresso">
                {formatCurrency(order.totalAmount)}
              </p>
              <p className="text-sm text-brand-mocha">
                Balance {formatCurrency(order.balanceAmount)}
              </p>
              {order.accountingJournalEntryId ? (
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(
                      order.accountingJournalEntryId,
                    )}`}
                  >
                    View Journal
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-brand-cappuccino/60">
            {order.items.map((item) => (
              <div
                className="grid gap-2 border-b border-brand-cappuccino/40 p-4 text-sm last:border-b-0 md:grid-cols-[1fr_auto]"
                key={item.id}
              >
                <div>
                  <p className="font-semibold text-brand-espresso">{item.itemNameSnapshot}</p>
                  {item.itemSource === "custom" ? (
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-mocha">
                      Custom item
                    </p>
                  ) : null}
                  <p className="text-brand-mocha">
                    Qty {item.quantity} - {item.unitName}
                    {item.weight !== null ? ` - ${String(item.weight)} kg` : ""}
                    {item.flavor ? ` - ${item.flavor}` : ""}
                    {item.messageText ? ` - "${item.messageText}"` : ""}
                  </p>
                  {item.designNotes ? (
                    <p className="mt-1 text-brand-mocha">{item.designNotes}</p>
                  ) : null}
                  <div className="mt-3">
                    <OrderItemConversionActions
                      canConvertToProduct={canConvertCustomItemToProduct}
                      canConvertToVariant={canConvertCustomItemToVariant}
                      item={item}
                      orderId={order.id}
                    />
                  </div>
                </div>
                <p className="font-semibold text-brand-espresso">
                  {formatCurrency(item.lineTotal)}
                </p>
              </div>
            ))}
          </div>
          {order.chargeAmount > 0 || order.chargeTaxAmount > 0 ? (
            <div className="mt-5 rounded-2xl border border-brand-cappuccino/60 bg-brand-latte/60 p-4">
              <h3 className="font-semibold text-brand-espresso">Charges</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {order.charges.map((charge) => (
                  <div
                    className="flex items-start justify-between gap-3"
                    key={charge.id || charge.chargeName}
                  >
                    <div>
                      <p className="font-medium text-brand-espresso">{charge.chargeName}</p>
                      {charge.description ? (
                        <p className="text-xs text-brand-mocha">{charge.description}</p>
                      ) : null}
                    </div>
                    <p className="font-semibold text-brand-espresso">
                      {formatCurrency(charge.totalAmount)}
                    </p>
                  </div>
                ))}
                <div className="flex justify-between border-t border-brand-cappuccino/60 pt-2">
                  <span className="text-brand-mocha">Charge tax</span>
                  <strong className="text-brand-espresso">
                    {formatCurrency(order.chargeTaxAmount)}
                  </strong>
                </div>
              </div>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {transitions.map((status) => (
              <Button
                disabled={!canManage || order.orderStatus === status || statusMutation.isPending}
                className={
                  status === "cancelled" ? "border-red-300 text-red-800 hover:bg-red-50" : undefined
                }
                key={status}
                onClick={() => {
                  void (async () => {
                    try {
                      await statusMutation.mutateAsync({ id: order.id, payload: { status } });
                      toast.success("Order status updated.");
                    } catch (error: unknown) {
                      toast.error(getErrorMessage(error));
                    }
                  })();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {status.replace("_", " ")}
              </Button>
            ))}
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-6">
            <OrderPaymentSection canManage={canManage} order={order} />
            <OrderProductionSection canManage={canManage} order={order} />
            <OrderPackagingSection canManage={canManage} order={order} />
          </div>
          <OrderTimeline status={order.orderStatus} />
        </div>
      </div>
    </main>
  );
}
