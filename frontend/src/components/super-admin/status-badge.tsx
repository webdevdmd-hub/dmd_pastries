import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const normalized = status.toLowerCase();
  const className =
    normalized === "active" || normalized === "trialing" || normalized === "verified"
      ? "border-money/30 bg-money-tint text-money-text"
      : normalized === "inactive" || normalized === "suspended" || normalized === "critical"
        ? "border-danger/30 bg-danger-tint text-danger-text"
        : "border-border bg-muted text-foreground-muted";

  return (
    <Badge className={className} variant="outline">
      {status || "unknown"}
    </Badge>
  );
}
