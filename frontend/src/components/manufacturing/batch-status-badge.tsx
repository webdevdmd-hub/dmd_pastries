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
      ? "border-neutral-950 bg-neutral-950 text-white"
      : status === "cancelled"
        ? "border-red-300 bg-red-50 text-red-700"
        : status === "in_progress" || status === "partially_completed"
          ? "border-neutral-300 bg-neutral-200 text-neutral-800"
          : "border-neutral-300 bg-neutral-100 text-neutral-600";

  return (
    <Badge
      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${className}`}
      variant="outline"
    >
      {labels[status]}
    </Badge>
  );
}
