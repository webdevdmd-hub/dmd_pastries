import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { SalesReturnStatus } from "@/types/sales-return";

const statusStyles: Record<SalesReturnStatus, string> = {
  draft: "border-warning/30 bg-warning-tint text-warning-text",
  posted: "border-money/30 bg-money-tint text-money-text",
  cancelled: "border-border bg-muted text-foreground-muted",
  reversed: "border-info/30 bg-info-tint text-info-text",
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
