import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { IngredientStatus } from "@/types/ingredient";

export function IngredientStatusBadge({ status }: { status: IngredientStatus }): JSX.Element {
  return (
    <Badge
      className={
        status === "active"
          ? "border-money/30 bg-money-tint text-money-text"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
      }
      variant="outline"
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
