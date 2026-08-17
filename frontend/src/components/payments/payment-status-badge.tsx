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
      return "border-money/30 bg-money-tint text-money-text";
    case "pending":
    case "submitted":
      return "border-warning/30 bg-warning-tint text-warning-text";
    case "failed":
    case "rejected":
      return "border-danger/30 bg-danger-tint text-danger-text";
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
