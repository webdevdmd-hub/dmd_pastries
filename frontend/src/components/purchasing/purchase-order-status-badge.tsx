import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/types/purchasing";

const labels: Record<PurchaseOrderStatus, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially received",
  received: "Received",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }): JSX.Element {
  const variant = status === "received" ? "default" : "outline";
  const className =
    status === "cancelled" ? "border-danger/30 bg-danger-tint text-danger-text" : undefined;

  return (
    <Badge className={className} variant={variant}>
      {labels[status]}
    </Badge>
  );
}
