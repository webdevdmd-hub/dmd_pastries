"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import {
  ORDER_DETAIL_ITEM_QUERY_KEY,
  ORDER_DETAIL_TAB_QUERY_KEY,
  type OrderDetailTabKey,
  parseOrderDetailTab,
} from "@/components/orders/order-detail-tabs";
import { OrderDetailsPanel } from "@/components/orders/order-details-panel";
import { OrderHeader } from "@/components/orders/order-header";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { useOrderDetailPermissions } from "@/components/orders/use-order-detail-permissions";
import { useOrder } from "@/hooks/use-orders";
import { ApiError, getErrorMessage } from "@/lib/api/client";

function isPermissionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * The full-page view of one order at `/orders/[id]`.
 *
 * The orders list opens the same content in a drawer; this page remains for
 * deep links, "open in new tab" from the drawer, and as the Edit target.
 */
export function OrderDetailsPageClient({ orderId }: { orderId: string }): JSX.Element {
  const permissions = useOrderDetailPermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orderQuery = useOrder(orderId, permissions.canView);

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

  if (!permissions.canView) {
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
    <div className="grid gap-6">
      <OrderHeader canManage={permissions.canManage} isSaving={false} order={order} />
      <OrderDetailsPanel
        activeTab={activeTab}
        canConvertToProduct={permissions.canConvertToProduct}
        canConvertToVariant={permissions.canConvertToVariant}
        canManage={permissions.canManage}
        onSelectItem={selectItem}
        onTabChange={changeTab}
        order={order}
        selectedItemId={selectedItemId}
      />
    </div>
  );
}
