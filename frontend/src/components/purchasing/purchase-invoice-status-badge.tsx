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
  cancelled: "border-red-300 bg-red-50 text-red-800",
  draft: "border-zinc-300 bg-zinc-50 text-zinc-700",
  posted: "border-emerald-300 bg-emerald-50 text-emerald-800",
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
