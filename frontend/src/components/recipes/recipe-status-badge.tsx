"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { RecipeStatus } from "@/types/recipes";

export function RecipeStatusBadge({ status }: { status: RecipeStatus }): JSX.Element {
  const className =
    status === "active"
      ? "border-money/30 bg-money-tint text-money-text"
      : status === "archived"
        ? "border-danger/30 bg-danger-tint text-danger-text"
        : status === "inactive"
          ? "border-border bg-muted text-foreground-muted"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha";

  return (
    <Badge className={className} variant="outline">
      {status.replace("_", " ")}
    </Badge>
  );
}
