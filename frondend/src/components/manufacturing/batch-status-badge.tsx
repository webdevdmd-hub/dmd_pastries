import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { BatchStatus } from "@/types/manufacturing";

const labels: Record<BatchStatus, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  draft: "Draft",
  in_progress: "In progress",
  partially_completed: "Partially completed",
};

export function BatchStatusBadge({ status }: { status: BatchStatus }): JSX.Element {
  const className =
    status === "cancelled"
      ? "border-red-300 bg-red-50 text-red-800"
      : status === "in_progress" || status === "partially_completed"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : undefined;
  const variant = status === "completed" ? "default" : "outline";

  return (
    <Badge className={className} variant={variant}>
      {labels[status]}
    </Badge>
  );
}
