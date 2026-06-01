"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { RecipeStatus } from "@/types/recipes";

export function RecipeStatusBadge({ status }: { status: RecipeStatus }): JSX.Element {
  const className =
    status === "active"
      ? "border-green-200 bg-green-50 text-green-800"
      : status === "archived"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "inactive"
          ? "border-neutral-200 bg-neutral-100 text-neutral-700"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha";

  return (
    <Badge className={className} variant="outline">
      {status.replace("_", " ")}
    </Badge>
  );
}
