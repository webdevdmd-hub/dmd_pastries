import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { BatchStatus } from "@/types/manufacturing";

const labels: Record<BatchStatus, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  draft: "Planned",
  in_progress: "In progress",
  partially_completed: "Partially completed",
  planned: "Planned",
};

export function BatchStatusBadge({ status }: { status: BatchStatus }): JSX.Element {
  const className =
    status === "completed"
      ? "border-primary bg-primary text-primary-foreground"
      : status === "cancelled"
        ? "border-danger/30 bg-danger-tint text-danger-text"
        : status === "in_progress" || status === "partially_completed"
          ? "border-border bg-muted text-foreground"
          : "border-border bg-muted text-foreground-muted";

  return (
    <Badge
      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${className}`}
      variant="outline"
    >
      {labels[status]}
    </Badge>
  );
}
