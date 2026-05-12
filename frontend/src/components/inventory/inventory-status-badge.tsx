import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { InventoryStatus } from "@/types/inventory";

type InventoryStatusBadgeProps = {
  status: InventoryStatus;
};

export function InventoryStatusBadge({ status }: InventoryStatusBadgeProps): JSX.Element {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
