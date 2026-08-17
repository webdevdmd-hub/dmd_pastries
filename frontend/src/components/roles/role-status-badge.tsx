import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { RoleStatus } from "@/types/role";

type RoleStatusBadgeProps = {
  status: RoleStatus;
};

export function RoleStatusBadge({ status }: RoleStatusBadgeProps): JSX.Element {
  if (status === "inactive") {
    return (
      <Badge className="border-brand-cappuccino bg-brand-cappuccino/35 text-brand-mocha">
        Inactive
      </Badge>
    );
  }

  return <Badge className="border-money/20 bg-money-tint text-money-text">Active</Badge>;
}
