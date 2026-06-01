import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseInvoiceStatus } from "@/types/purchasing";

const labels: Record<PurchaseInvoiceStatus, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  posted: "Posted",
};

export function PurchaseInvoiceStatusBadge({
  status,
}: {
  status: PurchaseInvoiceStatus;
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
