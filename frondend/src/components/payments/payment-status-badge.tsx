import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PaymentStatus, ReconciliationStatus, RefundStatus } from "@/types/payment";

type PaymentStatusBadgeProps = {
  status: PaymentStatus | RefundStatus | ReconciliationStatus;
};

function getStatusClass(status: PaymentStatus | RefundStatus | ReconciliationStatus): string {
  switch (status) {
    case "completed":
    case "approved":
      return "border-green-700/30 bg-green-100 text-green-800";
    case "pending":
    case "submitted":
      return "border-amber-700/30 bg-amber-100 text-amber-900";
    case "failed":
    case "rejected":
      return "border-red-700/30 bg-red-100 text-red-800";
    case "refunded":
    case "cancelled":
      return "border-brand-mocha/20 bg-brand-cappuccino/40 text-brand-mocha";
    case "partially_refunded":
    case "draft":
      return "border-brand-caramel/30 bg-brand-latte text-brand-mocha";
    default:
      return "border-brand-cappuccino bg-brand-latte text-brand-mocha";
  }
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps): JSX.Element {
  return (
    <Badge className={getStatusClass(status)} variant="outline">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
