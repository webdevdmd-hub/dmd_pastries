import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { InventoryRecordStatus } from "@/types/inventory";

type InventoryStatusBadgeProps = {
  status: InventoryRecordStatus;
};

export function InventoryStatusBadge({ status }: InventoryStatusBadgeProps): JSX.Element {
  if (status === "not_initialized") {
    return <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">Not initialized</Badge>;
  }

  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
