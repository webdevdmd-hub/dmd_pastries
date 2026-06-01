"use client";

import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recipe } from "@/types/recipes";

export function RecipeYieldCard({ recipe }: { recipe: Recipe | null }): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardHeader>
        <CardTitle>Yield</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-brand-mocha">
        <div className="flex justify-between">
          <span>Batch yield</span>
          <strong className="text-brand-espresso">
            {recipe
              ? `${String(recipe.batchYieldQuantity)} ${recipe.batchYieldUnitName}`
              : "Not saved"}
          </strong>
        </div>
        <div className="flex justify-between">
          <span>Preparation time</span>
          <strong className="text-brand-espresso">
            {recipe?.preparationTimeMinutes ?? 0} minutes
          </strong>
        </div>
      </CardContent>
    </Card>
  );
}
