"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import {
  ORDER_DETAIL_ITEM_QUERY_KEY,
  ORDER_DETAIL_TAB_QUERY_KEY,
  type OrderDetailTabKey,
  parseOrderDetailTab,
} from "@/components/orders/order-detail-tabs";
import {
  ORDER_DETAIL_TABPANEL_ID,
  OrderDetailViewTabs,
} from "@/components/orders/order-detail-view-tabs";
import { OrderHeader } from "@/components/orders/order-header";
import { OrderItemDetailsSheet } from "@/components/orders/order-item-details-sheet";
import { OrderItemsList } from "@/components/orders/order-items-list";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orderQuery = useOrder(orderId, canView);
  const statusMutation = useUpdateOrderStatus();

  const activeTab = parseOrderDetailTab(searchParams.get(ORDER_DETAIL_TAB_QUERY_KEY));

  // The open item is component state seeded from `?item=`, not read from the
  // URL on every render. A router navigation for a search-param change makes
  // the server re-render the page segment, which remounts this component about
  // a second later: the focused row vanishes, Radix reads that as a dismiss,
  // and the sheet closes itself. So the URL is mirrored through the history
  // API instead, which Next syncs without a round trip.
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() =>
    searchParams.get(ORDER_DETAIL_ITEM_QUERY_KEY),
  );

  const changeTab = (tab: OrderDetailTabKey): void => {
    const next = new URLSearchParams(window.location.search);
    if (tab === "items") {
      next.delete(ORDER_DETAIL_TAB_QUERY_KEY);
    } else {
      next.set(ORDER_DETAIL_TAB_QUERY_KEY, tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const selectItem = (itemId: string | null): void => {
    setSelectedItemId(itemId);
    const next = new URLSearchParams(window.location.search);
    if (itemId) {
      next.set(ORDER_DETAIL_ITEM_QUERY_KEY, itemId);
    } else {
      next.delete(ORDER_DETAIL_ITEM_QUERY_KEY);
    }
    const query = next.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

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
  const selectedItem = order.items.find((item) => item.id === selectedItemId) ?? null;

  return (
    <>
      <div className="grid gap-6">
        <OrderHeader canManage={canManage} isSaving={false} order={order} />
        <section className="rounded-3xl border border-brand-cappuccino/60 bg-card/85 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-title text-brand-espresso">
                {order.customerNameSnapshot || "Walk-in customer"}
              </h2>
              <p className="text-body text-brand-mocha">
                {order.customerPhoneSnapshot ?? "No phone number"}
              </p>
              <p className="mt-2 text-cell capitalize text-brand-mocha">
                {order.orderType} - Event {formatDateOnly(order.eventDate, "Not set")}
              </p>
            </div>
            <div className="grid gap-2 text-right">
              <div className="flex justify-end">
                <OrderStatusBadge status={order.orderStatus} />
              </div>
              <p className="text-kpi tabular-nums text-brand-espresso">
                {formatCurrency(order.totalAmount)}
              </p>
              <p className="text-cell tabular-nums text-brand-mocha">
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
          <div className="mt-5 flex flex-wrap gap-2">
            {transitions.map((status) => (
              <Button
                disabled={!canManage || order.orderStatus === status || statusMutation.isPending}
                className={
                  status === "cancelled"
                    ? "border-danger/30 text-danger-text hover:bg-danger-tint"
                    : undefined
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

        <OrderDetailViewTabs
          active={activeTab}
          itemsCount={order.items.length}
          onTabChange={changeTab}
          orderId={order.id}
        />

        {/* One panel element that swaps, which is what `aria-controls` on every
            tab points at. Payments, production and packaging own their own
            queries and only mount when selected. */}
        <div id={ORDER_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
          {activeTab === "items" ? (
            <OrderItemsList onSelectItem={(item) => selectItem(item.id)} order={order} />
          ) : null}
          {activeTab === "payments" ? (
            <OrderPaymentSection canManage={canManage} order={order} />
          ) : null}
          {activeTab === "production" ? (
            <OrderProductionSection canManage={canManage} order={order} />
          ) : null}
          {activeTab === "packaging" ? (
            <OrderPackagingSection canManage={canManage} order={order} />
          ) : null}
          {activeTab === "timeline" ? <OrderTimeline status={order.orderStatus} /> : null}
        </div>
      </div>

      <OrderItemDetailsSheet
        canConvertToProduct={canConvertCustomItemToProduct}
        canConvertToVariant={canConvertCustomItemToVariant}
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            selectItem(null);
          }
        }}
        open={selectedItem !== null}
        orderId={order.id}
      />
    </>
  );
}
