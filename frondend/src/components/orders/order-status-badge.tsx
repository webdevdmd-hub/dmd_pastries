import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { OrderPaymentStatus, OrderStatus } from "@/types/orders";

function label(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OrderStatusBadge({ status }: { status: OrderStatus }): JSX.Element {
  const className =
    status === "cancelled"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "ready" || status === "delivered" || status === "completed"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "in_production" || status === "confirmed"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha";

  return (
    <Badge className={className} variant="outline">
      {label(status)}
    </Badge>
  );
}

export function OrderPaymentStatusBadge({ status }: { status: OrderPaymentStatus }): JSX.Element {
  const className =
    status === "paid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "refunded"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha";

  return (
    <Badge className={className} variant="outline">
      {label(status)}
    </Badge>
  );
}
