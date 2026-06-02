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
      ? "border-red-300 bg-red-50 text-red-800"
      : status === "reversed"
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : status === "posted"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : undefined;

  return (
    <Badge className={className} variant="outline">
      {labels[status]}
    </Badge>
  );
}
