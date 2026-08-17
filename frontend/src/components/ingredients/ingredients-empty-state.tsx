import { Wheat } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";

type IngredientsEmptyStateProps = {
  canManage: boolean;
  onCreate: () => void;
};

export function IngredientsEmptyState({
  canManage,
  onCreate,
}: IngredientsEmptyStateProps): JSX.Element {
  return (
    <div className="grid place-items-center rounded-3xl border border-brand-cappuccino bg-card/70 p-12 text-center shadow-soft">
      <div className="grid max-w-md gap-4">
        <Wheat className="mx-auto h-10 w-10 text-brand-mocha" />
        <h2 className="text-2xl font-bold text-brand-espresso">No ingredients found.</h2>
        <p className="text-brand-mocha">
          Create raw materials like flour, sugar, dairy, chocolate, and flavoring for inventory,
          recipes, and purchasing.
        </p>
        {canManage ? (
          <Button className="mx-auto" onClick={onCreate} type="button">
            Add Ingredient
          </Button>
        ) : null}
      </div>
    </div>
  );
}
