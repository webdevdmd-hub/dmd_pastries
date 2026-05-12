"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { ProductType } from "@/types/product";

type ProductTypeBadgeProps = {
  type: ProductType;
};

const labels: Record<ProductType, string> = {
  ready_to_sell: "Ready to Sell",
  made_to_order: "Made to Order",
  manufactured: "Manufactured",
  retail: "Retail",
  service: "Service",
};

export function ProductTypeBadge({ type }: ProductTypeBadgeProps): JSX.Element {
  return (
    <Badge className="bg-brand-cappuccino/50 text-brand-espresso hover:bg-brand-cappuccino/50">
      {labels[type]}
    </Badge>
  );
}
