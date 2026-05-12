"use client";

import { ClipboardList } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function RecipesEmptyState({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <ClipboardList className="h-12 w-12 text-brand-mocha" />
        <div>
          <h2 className="text-2xl font-bold text-brand-espresso">No recipes found.</h2>
          <p className="mt-2 max-w-xl text-sm text-brand-mocha">
            Create your first BOM to define ingredients, packaging, yield, and cost for a product.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onCreate} type="button">
            Create Recipe
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
