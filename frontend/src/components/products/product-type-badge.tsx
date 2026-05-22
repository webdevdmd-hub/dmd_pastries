"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { ProductType } from "@/types/product";

type ProductTypeBadgeProps = {
  className?: string;
  type: ProductType;
};

const labels: Record<ProductType, string> = {
  ready_to_sell: "Ready to Sell",
  made_to_order: "Made to Order",
  manufactured: "Manufactured",
  retail: "Retail",
  service: "Service",
};

export function ProductTypeBadge({ className, type }: ProductTypeBadgeProps): JSX.Element {
  return (
    <Badge
      className={cn(
        "border-brand-cappuccino/80 bg-brand-latte text-brand-espresso hover:bg-brand-latte",
        className,
      )}
    >
      {labels[type]}
    </Badge>
  );
}
