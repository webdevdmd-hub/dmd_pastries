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
    <Card>
      <CardContent className="p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/40 text-brand-caramel">
          <PackagePlus className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold text-brand-espresso">No products found.</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-brand-mocha">
          Create your first product to start selling through POS billing.
        </p>
        {canCreate ? (
          <Button className="mt-5" onClick={onCreate}>
            Add Product
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
