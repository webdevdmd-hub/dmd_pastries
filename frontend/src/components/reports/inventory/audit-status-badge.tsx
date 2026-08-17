import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";

export function AuditStatusBadge({ isBalanced }: { isBalanced: boolean }): JSX.Element {
  return (
    <Badge
      className={
        isBalanced
          ? "border-money/30 bg-money-tint text-money-text"
          : "border-danger/30 bg-danger-tint text-danger-text"
      }
      variant="outline"
    >
      {isBalanced ? "Balanced" : "Mismatch"}
    </Badge>
  );
}
