"use client";

import { ExternalLink, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import {
  DEFAULT_ORDER_DETAIL_TAB,
  type OrderDetailTabKey,
} from "@/components/orders/order-detail-tabs";
import { OrderDetailsPanel } from "@/components/orders/order-details-panel";
import { OrderPaymentStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { useOrderDetailPermissions } from "@/components/orders/use-order-detail-permissions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { useOrder } from "@/hooks/use-orders";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder } from "@/types/orders";

type OrderDetailsDrawerProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orderId: string | null;
};

function isPermissionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * One order's details in a sheet over the orders list, the way a product's
 * details open over the products list.
 *
 * The tab and the open item are plain state here rather than URL params: the
 * list's own URL should stay the list's, and a router navigation would remount
 * the page underneath the sheet. The header offers the full page for anyone
 * who wants a URL to share.
 */
export function OrderDetailsDrawer({
  onOpenChange,
  open,
  orderId,
}: OrderDetailsDrawerProps): JSX.Element {
  const permissions = useOrderDetailPermissions();
  const orderQuery = useOrder(orderId, open && orderId !== null && permissions.canView);

  // Radix requires a title in every dialog for screen readers. The body renders
  // the order number as the visible title; the states before it name the sheet
  // invisibly so the requirement holds while loading or on error.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Order details</SheetTitle>
      <SheetDescription>Details of the selected bakery order.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {!permissions.canView ? (
          <>
            {fallbackTitle}
            <AccessDeniedCard />
          </>
        ) : orderQuery.isLoading ? (
          <>
            {fallbackTitle}
            <div className="flex min-h-[50vh] items-center justify-center text-brand-mocha">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading order...
            </div>
          </>
        ) : isPermissionDenied(orderQuery.error) ? (
          <>
            {fallbackTitle}
            <AccessDeniedCard />
          </>
        ) : orderQuery.isError || !orderQuery.data ? (
          <>
            {fallbackTitle}
            <OrdersErrorState
              description={getErrorMessage(orderQuery.error)}
              onRetry={() => void orderQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by order so switching orders resets the tab and open item
          // instead of carrying one order's Production tab into the next.
          <OrderDetailsDrawerBody
            canConvertToProduct={permissions.canConvertToProduct}
            canConvertToVariant={permissions.canConvertToVariant}
            canManage={permissions.canManage}
            key={orderQuery.data.id}
            order={orderQuery.data}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderDetailsDrawerBody({
  canConvertToProduct,
  canConvertToVariant,
  canManage,
  order,
}: {
  canConvertToProduct: boolean;
  canConvertToVariant: boolean;
  canManage: boolean;
  order: BakeryOrder;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<OrderDetailTabKey>(DEFAULT_ORDER_DETAIL_TAB);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const detailHref = `${ROUTES.orders}/${order.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="font-serif text-page font-normal">{order.orderNumber}</SheetTitle>
          <OrderStatusBadge status={order.orderStatus} />
          <OrderPaymentStatusBadge status={order.paymentStatus} />
        </div>
        <SheetDescription>
          Review schedule, items, payment, production, and packaging.
        </SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canManage ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`${detailHref}?mode=edit`}>
                <Pencil className="h-4 w-4" />
                Edit order
              </Link>
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <OrderDetailsPanel
        activeTab={activeTab}
        canConvertToProduct={canConvertToProduct}
        canConvertToVariant={canConvertToVariant}
        canManage={canManage}
        onSelectItem={setSelectedItemId}
        onTabChange={setActiveTab}
        order={order}
        selectedItemId={selectedItemId}
      />
    </div>
  );
}
