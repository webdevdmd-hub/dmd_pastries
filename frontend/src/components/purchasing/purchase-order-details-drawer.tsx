"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import {
  DEFAULT_PURCHASE_ORDER_DETAIL_TAB,
  type PurchaseOrderDetailTabKey,
} from "@/components/purchasing/purchase-order-detail-tabs";
import {
  formatPurchaseOrderMoney,
  PurchaseOrderDetailsPanel,
} from "@/components/purchasing/purchase-order-details-panel";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { usePurchaseOrder } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import { formatDateOnly } from "@/lib/format/date";
import type { PurchaseOrder } from "@/types/purchasing";

type PurchaseOrderDetailsDrawerProps = {
  /** Whether the viewer may edit the order in its current status. */
  canEditOrder: (order: PurchaseOrder) => boolean;
  canView: boolean;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((order: PurchaseOrder) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orderId: string | null;
};

/**
 * One purchase order in a sheet over the list. The list rows carry only a
 * summary, so the drawer fetches the record itself. The tab is plain state
 * here; the header offers the full page for anyone who wants a URL.
 */
export function PurchaseOrderDetailsDrawer({
  canEditOrder,
  canView,
  onEdit,
  onOpenChange,
  open,
  orderId,
}: PurchaseOrderDetailsDrawerProps): JSX.Element {
  const orderQuery = usePurchaseOrder(orderId, open && orderId !== null && canView);

  // Radix requires a title in every dialog. The body renders the order
  // number; the states before it name the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Purchase order details</SheetTitle>
      <SheetDescription>Details of the selected purchase order.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {!canView ? (
          <>
            {fallbackTitle}
            <AccessDeniedCard />
          </>
        ) : orderQuery.isLoading ? (
          <>
            {fallbackTitle}
            <PurchaseTableSkeleton />
          </>
        ) : orderQuery.error || !orderQuery.data ? (
          <>
            {fallbackTitle}
            <PurchaseErrorState
              description={
                orderQuery.error ? getErrorMessage(orderQuery.error) : "Purchase order not found."
              }
              onRetry={() => void orderQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by order so switching orders resets the tab.
          <PurchaseOrderDetailsDrawerBody
            canEdit={canEditOrder(orderQuery.data)}
            canView={canView}
            key={orderQuery.data.id}
            onEdit={onEdit}
            order={orderQuery.data}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PurchaseOrderDetailsDrawerBody({
  canEdit,
  canView,
  onEdit,
  order,
}: {
  canEdit: boolean;
  canView: boolean;
  onEdit: ((order: PurchaseOrder) => void) | undefined;
  order: PurchaseOrder;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PurchaseOrderDetailTabKey>(
    DEFAULT_PURCHASE_ORDER_DETAIL_TAB,
  );
  const detailHref = `${ROUTES.purchasingOrders}/${order.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="font-mono text-page">{order.purchaseOrderNumber}</SheetTitle>
          <PurchaseOrderStatusBadge status={order.status} />
        </div>
        <SheetDescription>
          {order.supplierName} · {order.branchName} · Ordered{" "}
          <span className="tabular-nums">{formatDateOnly(order.orderDate)}</span>
          {order.expectedDeliveryDate ? (
            <>
              {" "}
              · Expected{" "}
              <span className="tabular-nums">{formatDateOnly(order.expectedDeliveryDate)}</span>
            </>
          ) : null}
        </SheetDescription>
        <p className="text-kpi tabular-nums">{formatPurchaseOrderMoney(order.totalAmount)}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canEdit && onEdit ? (
            <Button onClick={() => onEdit(order)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit order
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <PurchaseOrderDetailsPanel
        activeTab={activeTab}
        canView={canView}
        onTabChange={setActiveTab}
        order={order}
      />
    </div>
  );
}
