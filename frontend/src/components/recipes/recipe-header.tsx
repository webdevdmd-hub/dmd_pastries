"use client";

import Link from "next/link";
import type { JSX } from "react";

import { RecipeStatusBadge } from "@/components/recipes/recipe-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { Recipe } from "@/types/recipes";

export function RecipeHeader({
  canManage,
  onActivate,
  onCreateVersion,
  recipe,
}: {
  canManage: boolean;
  onActivate: () => void;
  onCreateVersion: () => void;
  recipe: Recipe | null;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.recipes}
        >
          Back to Recipes
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">
            {recipe ? recipe.recipeName : "Create Recipe"}
          </h1>
          {recipe ? <RecipeStatusBadge status={recipe.status} /> : null}
          {recipe?.isActive ? <Badge>Active BOM</Badge> : null}
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {recipe ? `${recipe.recipeCode} · ${recipe.productName}` : "Define a new product BOM."}
        </p>
      </div>
      {canManage && recipe ? (
        <div className="flex flex-wrap gap-3">
          <Button disabled={recipe.isActive} onClick={onActivate} type="button" variant="outline">
            Activate
          </Button>
          <Button onClick={onCreateVersion} type="button" variant="outline">
            Create version
          </Button>
        </div>
      ) : null}
    </div>
  );
}
