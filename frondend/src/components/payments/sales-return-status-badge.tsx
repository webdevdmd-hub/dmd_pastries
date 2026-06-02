import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { SalesReturnStatus } from "@/types/sales-return";

const statusStyles: Record<SalesReturnStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  posted: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-stone-200 bg-stone-100 text-stone-700",
  reversed: "border-sky-200 bg-sky-50 text-sky-800",
};

function statusLabel(status: SalesReturnStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function SalesReturnStatusBadge({ status }: { status: SalesReturnStatus }): JSX.Element {
  return (
    <Badge className={statusStyles[status]} variant="outline">
      {statusLabel(status)}
    </Badge>
  );
}
