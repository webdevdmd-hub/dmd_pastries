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
          "border-money/30 bg-money-tint text-money-text hover:bg-money-tint",
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
        className={cn("border-border bg-muted text-foreground-muted hover:bg-muted", className)}
      >
        Archived
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        "border-warning/30 bg-warning-tint text-warning-text hover:bg-warning-tint",
        className,
      )}
    >
      Inactive
    </Badge>
  );
}
