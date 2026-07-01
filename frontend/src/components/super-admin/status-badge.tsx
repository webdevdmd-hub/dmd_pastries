import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const normalized = status.toLowerCase();
  const className =
    normalized === "active" || normalized === "trialing" || normalized === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : normalized === "inactive" || normalized === "suspended" || normalized === "critical"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-stone-300 bg-stone-50 text-stone-700";

  return (
    <Badge className={className} variant="outline">
      {status || "unknown"}
    </Badge>
  );
}
