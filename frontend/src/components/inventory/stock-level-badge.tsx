import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/types/inventory";

type StockLevelBadgeProps = {
  item: InventoryItem;
};

export function StockLevelBadge({ item }: StockLevelBadgeProps): JSX.Element {
  if (item.status === "not_initialized") {
    return <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">Needs opening stock</Badge>;
  }

  if (item.availableQuantity <= 0) {
    return <Badge className="border-red-200 bg-red-100 text-red-900">Out of stock</Badge>;
  }

  if (item.lowStock) {
    return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Low stock</Badge>;
  }

  return <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Normal</Badge>;
}
