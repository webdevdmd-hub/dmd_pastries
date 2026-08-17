import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseReturnStatus } from "@/types/purchasing";

const labels: Record<PurchaseReturnStatus, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
};

export function PurchaseReturnStatusBadge({
  status,
}: {
  status: PurchaseReturnStatus;
}): JSX.Element {
  const className =
    status === "cancelled"
      ? "border-danger/30 bg-danger-tint text-danger-text"
      : status === "reversed"
        ? "border-info/30 bg-info-tint text-info-text"
        : status === "posted"
          ? "border-money/30 bg-money-tint text-money-text"
          : undefined;

  return (
    <Badge className={className} variant="outline">
      {labels[status]}
    </Badge>
  );
}
