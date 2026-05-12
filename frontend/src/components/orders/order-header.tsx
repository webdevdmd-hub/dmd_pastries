"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { OrderPaymentStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import type { BakeryOrder } from "@/types/orders";

export function OrderHeader({
  canManage,
  isSaving,
  onSave,
  order,
}: {
  canManage: boolean;
  isSaving: boolean;
  onSave?: () => void;
  order: BakeryOrder | null;
}): JSX.Element {
  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-6 shadow-float lg:flex-row lg:items-center lg:justify-between">
      <div>
        <Button asChild className="mb-4" size="sm" variant="outline">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
        <h1 className="font-serif text-4xl text-brand-espresso">
          {order?.orderNumber ?? "Create Bakery Order"}
        </h1>
        <p className="mt-2 text-brand-mocha">
          {order
            ? "Review schedule, items, payment, production, and packaging."
            : "Create a custom cake or made-to-order bakery order."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {order ? (
          <>
            <OrderStatusBadge status={order.orderStatus} />
            <OrderPaymentStatusBadge status={order.paymentStatus} />
          </>
        ) : null}
        {onSave ? (
          <Button
            className="bg-brand-caramel text-white hover:bg-brand-mocha"
            disabled={!canManage || isSaving}
            onClick={onSave}
            type="button"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save order"}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
