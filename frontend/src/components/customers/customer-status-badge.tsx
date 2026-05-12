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
        status === "active" ? "border-emerald-300 bg-emerald-100 text-emerald-800" : undefined,
        status === "inactive"
          ? "border-brand-cappuccino bg-brand-latte text-brand-mocha"
          : undefined,
        status === "blocked" ? "border-red-200 bg-red-100 text-red-800" : undefined,
      )}
    >
      {labels[status]}
    </Badge>
  );
}
