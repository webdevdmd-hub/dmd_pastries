import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";

export function AuditStatusBadge({ isBalanced }: { isBalanced: boolean }): JSX.Element {
  return (
    <Badge
      className={
        isBalanced
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }
      variant="outline"
    >
      {isBalanced ? "Balanced" : "Mismatch"}
    </Badge>
  );
}
