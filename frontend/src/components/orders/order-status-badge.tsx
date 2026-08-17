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
      ? "border-danger/30 bg-danger-tint text-danger-text"
      : status === "ready" || status === "delivered" || status === "completed"
        ? "border-money/30 bg-money-tint text-money-text"
        : status === "in_production" || status === "confirmed"
          ? "border-warning/30 bg-warning-tint text-warning-text"
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
      ? "border-money/30 bg-money-tint text-money-text"
      : status === "partial"
        ? "border-warning/30 bg-warning-tint text-warning-text"
        : status === "refunded"
          ? "border-danger/30 bg-danger-tint text-danger-text"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha";

  return (
    <Badge className={className} variant="outline">
      {label(status)}
    </Badge>
  );
}
