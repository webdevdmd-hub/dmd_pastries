import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { PurchasePaymentStatus } from "@/types/purchasing";

const labels: Record<PurchasePaymentStatus, string> = {
  overdue: "Overdue",
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

const toneByStatus: Record<PurchasePaymentStatus, string> = {
  overdue: "border-danger/30 bg-danger-tint text-danger-text",
  paid: "border-money/30 bg-money-tint text-money-text",
  partial: "border-warning/30 bg-warning-tint text-warning-text",
  unpaid: "border-border bg-muted text-foreground-muted",
};

export function PurchasePaymentStatusBadge({
  status,
}: {
  status: PurchasePaymentStatus;
}): JSX.Element {
  return (
    <Badge className={cn("font-semibold", toneByStatus[status])} variant="outline">
      {labels[status]}
    </Badge>
  );
}
