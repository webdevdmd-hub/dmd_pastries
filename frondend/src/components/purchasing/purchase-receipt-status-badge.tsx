import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseReceiptStatus } from "@/types/purchasing";

const labels: Record<PurchaseReceiptStatus, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  posted: "Posted",
};

export function PurchaseReceiptStatusBadge({
  status,
}: {
  status: PurchaseReceiptStatus;
}): JSX.Element {
  return (
    <Badge
      className={status === "cancelled" ? "border-red-300 bg-red-50 text-red-800" : undefined}
      variant="outline"
    >
      {labels[status]}
    </Badge>
  );
}
