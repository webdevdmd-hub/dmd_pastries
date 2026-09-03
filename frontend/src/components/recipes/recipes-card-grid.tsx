"use client";

import type { JSX } from "react";

import { RecipeActionsMenu } from "@/components/recipes/recipe-actions-menu";
import {
  formatRecipeDate,
  formatRecipeMoney,
  recipeOutputLabel,
} from "@/components/recipes/recipe-details-drawer";
import { RecipeStatusBadge } from "@/components/recipes/recipe-status-badge";
import type { RecipesListProps } from "@/components/recipes/recipes-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** The recipe list as cards, for phones. */
export function RecipesCardGrid({ onView, recipes, ...actions }: RecipesListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {recipes.map((recipe) => (
        <Card
          className={`cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm ${
            recipe.status === "archived" ? "opacity-65" : ""
          }`}
          key={recipe.id}
          onClick={() => onView(recipe)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(recipe);
              }}
              type="button"
            >
              <span className="truncate font-medium">{recipe.recipeName}</span>
              <span className="truncate font-mono text-meta text-foreground-muted">
                {recipe.recipeCode} · v{recipe.versionNumber}
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <RecipeActionsMenu {...actions} recipe={recipe} />
            </div>
          </div>

          <div className="grid gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <RecipeStatusBadge status={recipe.status} />
              {recipe.isActive ? <Badge>Active BOM</Badge> : null}
            </div>
            <p className="text-cell text-foreground-muted">{recipeOutputLabel(recipe)}</p>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Batch yield</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {recipe.batchYieldQuantity} {recipe.batchYieldUnitName}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Cost per unit</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatRecipeMoney(recipe.costPerYieldUnit)}
              </p>
            </div>
          </div>

          <p className="border-t border-workspace-border px-4 py-2 text-meta tabular-nums text-foreground-muted">
            Updated {formatRecipeDate(recipe.updatedAt)}
          </p>
        </Card>
      ))}
    </div>
  );
}
