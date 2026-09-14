"use client";

import Link from "next/link";
import { type JSX, useState } from "react";
import { toast } from "sonner";

import type { OrderDetailTabKey } from "@/components/orders/order-detail-tabs";
import {
  ORDER_DETAIL_TABPANEL_ID,
  OrderDetailViewTabs,
} from "@/components/orders/order-detail-view-tabs";
import { OrderItemDetailsSheet } from "@/components/orders/order-item-details-sheet";
import { OrderItemsList } from "@/components/orders/order-items-list";
import { OrderPackagingSection } from "@/components/orders/order-packaging-section";
import { OrderPaymentSection } from "@/components/orders/order-payment-section";
import { OrderProductionSection } from "@/components/orders/order-production-section";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";
import { useUpdateOrderStatus } from "@/hooks/use-orders";
import { getErrorMessage } from "@/lib/api/client";
import { formatDateOnly } from "@/lib/utils/date-only";
import type { BakeryOrder, OrderStatus } from "@/types/orders";

type OrderDetailsPanelProps = {
  activeTab: OrderDetailTabKey;
  canConvertToProduct: boolean;
  canConvertToVariant: boolean;
  canManage: boolean;
  onSelectItem: (itemId: string | null) => void;
  onTabChange: (tab: OrderDetailTabKey) => void;
  order: BakeryOrder;
  selectedItemId: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

const transitions: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "delivered",
  "completed",
  "cancelled",
];

/**
 * The body of an order's details: summary, status buttons, the tab strip and
 * whichever panel is selected, plus the item sheet.
 *
 * Shared by the full page and the drawer over the orders list, which is why
 * the tab and the open item are props rather than state. The page keeps them
 * in the URL; the drawer keeps them in memory.
 */
export function OrderDetailsPanel({
  activeTab,
  canConvertToProduct,
  canConvertToVariant,
  canManage,
  onSelectItem,
  onTabChange,
  order,
  selectedItemId,
}: OrderDetailsPanelProps): JSX.Element {
  const statusMutation = useUpdateOrderStatus();
  const selectedItem = order.items.find((item) => item.id === selectedItemId) ?? null;
  // Regression: ISSUE-007 — "cancelled" fired its PATCH on a single click with
  // no dialog, no toast and no undo; a mis-tap cancelled a customer's order.
  // Found by /qa on 2026-09-14. Cancelling is the one transition here that
  // cannot be walked back, so it alone asks first; the list page already
  // confirms every status change through its own dialog.
  const [confirmCancel, setConfirmCancel] = useState(false);

  const applyStatus = async (status: OrderStatus): Promise<void> => {
    try {
      await statusMutation.mutateAsync({ id: order.id, payload: { status } });
      toast.success(status === "cancelled" ? "Order cancelled." : "Order status updated.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <div className="grid gap-6">
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
                  if (status === "cancelled") {
                    setConfirmCancel(true);
                    return;
                  }
                  void applyStatus(status);
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
          onTabChange={onTabChange}
          orderId={order.id}
        />

        {/* One panel element that swaps, which is what `aria-controls` on every
            tab points at. Payments, production and packaging own their own
            queries and only mount when selected. */}
        <div id={ORDER_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
          {activeTab === "items" ? (
            <OrderItemsList onSelectItem={(item) => onSelectItem(item.id)} order={order} />
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

      <Dialog
        onOpenChange={(open) => (!open ? setConfirmCancel(false) : undefined)}
        open={confirmCancel}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {order.orderNumber}?</DialogTitle>
            <DialogDescription>
              The order leaves every production and pickup list and cannot be reopened. Payments
              already recorded stay on the order for refund handling.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmCancel(false)} type="button" variant="outline">
              Keep order
            </Button>
            <Button
              className="border-danger/30 bg-danger-tint text-danger-text hover:bg-danger-tint"
              disabled={statusMutation.isPending}
              onClick={() => {
                setConfirmCancel(false);
                void applyStatus("cancelled");
              }}
              type="button"
              variant="outline"
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderItemDetailsSheet
        canConvertToProduct={canConvertToProduct}
        canConvertToVariant={canConvertToVariant}
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            onSelectItem(null);
          }
        }}
        open={selectedItem !== null}
        orderId={order.id}
      />
    </>
  );
}
