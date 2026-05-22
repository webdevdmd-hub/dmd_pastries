"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { ProductStatus } from "@/types/product";

type ProductStatusBadgeProps = {
  className?: string;
  status: ProductStatus;
};

export function ProductStatusBadge({ className, status }: ProductStatusBadgeProps): JSX.Element {
  if (status === "active") {
    return (
      <Badge
        className={cn(
          "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
          className,
        )}
      >
        Active
      </Badge>
    );
  }

  if (status === "archived") {
    return (
      <Badge
        className={cn("border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100", className)}
      >
        Archived
      </Badge>
    );
  }

  return (
    <Badge
      className={cn("border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50", className)}
    >
      Inactive
    </Badge>
  );
}
