import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { BranchStatus } from "@/types/branch";

type BranchStatusBadgeProps = {
  status: BranchStatus;
};

const statusStyles: Record<BranchStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-900",
  inactive: "border-brand-cappuccino bg-brand-cappuccino/35 text-brand-espresso",
};

export function BranchStatusBadge({ status }: BranchStatusBadgeProps): JSX.Element {
  return <Badge className={cn("capitalize", statusStyles[status])}>{status}</Badge>;
}
