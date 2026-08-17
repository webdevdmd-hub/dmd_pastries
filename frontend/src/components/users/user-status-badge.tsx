import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { UserStatus } from "@/types/user";

type UserStatusBadgeProps = {
  status: UserStatus;
};

const statusStyles: Record<UserStatus, string> = {
  active: "border-money/30 bg-money-tint text-money-text",
  inactive: "border-brand-cappuccino bg-brand-cappuccino/35 text-brand-espresso",
  invited: "border-brand-caramel/40 bg-brand-caramel/15 text-brand-mocha",
  suspended: "border-warning/30 bg-warning-tint text-warning-text",
};

export function UserStatusBadge({ status }: UserStatusBadgeProps): JSX.Element {
  return <Badge className={cn("capitalize", statusStyles[status])}>{status}</Badge>;
}
