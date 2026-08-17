import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { PurchaseInvoiceStatus } from "@/types/purchasing";

const labels: Record<PurchaseInvoiceStatus, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  posted: "Posted",
};

const toneByStatus: Record<PurchaseInvoiceStatus, string> = {
  cancelled: "border-danger/30 bg-danger-tint text-danger-text",
  draft: "border-border bg-muted text-foreground-muted",
  posted: "border-money/30 bg-money-tint text-money-text",
};

export function PurchaseInvoiceStatusBadge({
  status,
}: {
  status: PurchaseInvoiceStatus;
}): JSX.Element {
  return (
    <Badge className={cn("font-semibold", toneByStatus[status])} variant="outline">
      {labels[status]}
    </Badge>
  );
}
