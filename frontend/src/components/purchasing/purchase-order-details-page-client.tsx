"use client";

import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { usePurchaseOrder } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PurchaseOrderDetailsPageClient({ orderId }: { orderId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const orderQuery = usePurchaseOrder(orderId, canView);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (orderQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <PurchaseErrorState
        description={
          orderQuery.error ? getErrorMessage(orderQuery.error) : "Purchase order not found."
        }
        onRetry={() => {
          void orderQuery.refetch();
        }}
      />
    );
  }

  const order = orderQuery.data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.purchasingOrders}
        >
          Back to Purchase Orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{order.purchaseOrderNumber}</h1>
          <PurchaseOrderStatusBadge status={order.status} />
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {order.supplierName} · {order.branchName}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Subtotal</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.subtotalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Discount</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.discountAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Tax</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.taxAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Total</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.totalAmount)}
            </p>
          </CardContent>
        </Card>
      </div>
      <PurchasingItemLines lines={order.items} title="Purchase order items" />
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">{order.notes ?? "No notes recorded."}</p>
        </CardContent>
      </Card>
    </div>
  );
}
