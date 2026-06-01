import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { UserStatus } from "@/types/user";

type UserStatusBadgeProps = {
  status: UserStatus;
};

const statusStyles: Record<UserStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-900",
  inactive: "border-brand-cappuccino bg-brand-cappuccino/35 text-brand-espresso",
  invited: "border-brand-caramel/40 bg-brand-caramel/15 text-brand-mocha",
  suspended: "border-amber-300 bg-amber-100 text-amber-950",
};

export function UserStatusBadge({ status }: UserStatusBadgeProps): JSX.Element {
  return <Badge className={cn("capitalize", statusStyles[status])}>{status}</Badge>;
}
