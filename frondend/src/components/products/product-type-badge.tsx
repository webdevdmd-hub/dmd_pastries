"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { PRODUCT_TYPE_LABELS, type ProductType } from "@/types/product";

type ProductTypeBadgeProps = {
  className?: string;
  type: ProductType;
};

export function ProductTypeBadge({ className, type }: ProductTypeBadgeProps): JSX.Element {
  return (
    <Badge
      className={cn(
        "border-brand-cappuccino/80 bg-brand-latte text-brand-espresso hover:bg-brand-latte",
        className,
      )}
    >
      {PRODUCT_TYPE_LABELS[type]}
    </Badge>
  );
}
