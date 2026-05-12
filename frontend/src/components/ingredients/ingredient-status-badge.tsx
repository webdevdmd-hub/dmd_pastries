import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { IngredientStatus } from "@/types/ingredient";

export function IngredientStatusBadge({ status }: { status: IngredientStatus }): JSX.Element {
  return (
    <Badge
      className={
        status === "active"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
      }
      variant="outline"
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
