import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchasePaymentStatus } from "@/types/purchasing";

const labels: Record<PurchasePaymentStatus, string> = {
  overdue: "Overdue",
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

export function PurchasePaymentStatusBadge({
  status,
}: {
  status: PurchasePaymentStatus;
}): JSX.Element {
  const variant = status === "paid" ? "default" : "outline";
  const className = status === "overdue" ? "border-red-300 bg-red-50 text-red-800" : undefined;

  return (
    <Badge className={className} variant={variant}>
      {labels[status]}
    </Badge>
  );
}
