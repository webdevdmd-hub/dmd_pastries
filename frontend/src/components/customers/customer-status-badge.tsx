import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { CustomerStatus } from "@/types/customer";

const labels: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blocked: "Blocked",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }): JSX.Element {
  return (
    <Badge
      className={cn(
        status === "active" ? "border-money/30 bg-money-tint text-money-text" : undefined,
        status === "inactive"
          ? "border-brand-cappuccino bg-brand-latte text-brand-mocha"
          : undefined,
        status === "blocked" ? "border-danger/30 bg-danger-tint text-danger-text" : undefined,
      )}
    >
      {labels[status]}
    </Badge>
  );
}
