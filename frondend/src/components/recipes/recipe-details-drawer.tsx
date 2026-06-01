"use client";

import type { JSX } from "react";

import { RecipeStatusBadge } from "@/components/recipes/recipe-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import type { Recipe } from "@/types/recipes";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function recipeOutputLabel(recipe: Recipe): string {
  return recipe.productVariantName
    ? `${recipe.productName} - ${recipe.productVariantName}`
    : recipe.productName;
}

export function RecipeDetailsDrawer({
  onOpenChange,
  open,
  recipe,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  recipe: Recipe | null;
}): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{recipe?.recipeName ?? "Recipe details"}</SheetTitle>
          <SheetDescription>
            {recipe ? recipeOutputLabel(recipe) : "Recipe quick preview"}
          </SheetDescription>
        </SheetHeader>
        {recipe ? (
          <div className="mt-6 space-y-4">
            <RecipeStatusBadge status={recipe.status} />
            <div className="grid gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-brand-mocha">Output</span>
                <strong className="text-right">{recipeOutputLabel(recipe)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-mocha">Stock target</span>
                <strong>{recipe.productVariantName ? "Variant" : "Parent product"}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-mocha">Yield</span>
                <strong>
                  {recipe.batchYieldQuantity} {recipe.batchYieldUnitName}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-mocha">Ingredient cost</span>
                <strong>{formatCurrency(recipe.estimatedIngredientCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-mocha">Packaging cost</span>
                <strong>{formatCurrency(recipe.estimatedPackagingCost)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-mocha">Cost per unit</span>
                <strong>{formatCurrency(recipe.costPerYieldUnit)}</strong>
              </div>
            </div>
            <Button asChild className="w-full">
              <a href={`${ROUTES.recipes}/${recipe.id}`}>Open full recipe</a>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
