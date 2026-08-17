"use client";

import { PackagePlus } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ProductsEmptyStateProps = {
  canCreate: boolean;
  onCreate: () => void;
};

export function ProductsEmptyState({ canCreate, onCreate }: ProductsEmptyStateProps): JSX.Element {
  return (
    <Card className="border-brand-cappuccino bg-card/80">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-2xl bg-brand-cappuccino/40 p-4 text-brand-mocha">
          <PackagePlus className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-brand-espresso">No products found.</h2>
          <p className="mt-2 text-sm text-brand-mocha">
            Create a product to track current quantity, purchase cost, selling price, and POS
            availability.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={onCreate} type="button">
            Add product
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
