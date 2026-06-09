"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { ITEM_STRUCTURE_LABELS, type ItemStructure } from "@/types/product";

type ProductItemStructureBadgeProps = {
  className?: string;
  itemStructure: ItemStructure;
};

export function ProductItemStructureBadge({
  className,
  itemStructure,
}: ProductItemStructureBadgeProps): JSX.Element {
  return (
    <Badge
      className={cn(
        "border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-50",
        className,
      )}
      variant="outline"
    >
      {ITEM_STRUCTURE_LABELS[itemStructure]}
    </Badge>
  );
}
