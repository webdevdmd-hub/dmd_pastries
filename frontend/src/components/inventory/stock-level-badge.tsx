import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/types/inventory";

type StockLevelBadgeProps = {
  item: InventoryItem;
};

export function StockLevelBadge({ item }: StockLevelBadgeProps): JSX.Element {
  if (item.status === "not_initialized") {
    return (
      <Badge className="bg-info-tint text-info-text hover:bg-info-tint">Needs opening stock</Badge>
    );
  }

  if (item.availableQuantity <= 0) {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Out of stock</Badge>;
  }

  if (item.lowStock) {
    return (
      <Badge className="bg-warning-tint text-warning-text hover:bg-warning-tint">Low stock</Badge>
    );
  }

  return <Badge className="bg-money-tint text-money-text hover:bg-money-tint">Normal</Badge>;
}
