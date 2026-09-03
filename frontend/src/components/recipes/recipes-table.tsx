"use client";

import type { JSX } from "react";

import {
  type RecipeActionHandlers,
  RecipeActionsMenu,
} from "@/components/recipes/recipe-actions-menu";
import {
  formatRecipeDate,
  formatRecipeMoney,
  recipeOutputLabel,
} from "@/components/recipes/recipe-details-drawer";
import { RecipeStatusBadge } from "@/components/recipes/recipe-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Recipe } from "@/types/recipes";

export type RecipesListProps = RecipeActionHandlers & {
  /** Opens the recipe's details; the whole row is the target. */
  onView: (recipe: Recipe) => void;
  recipes: Recipe[];
};

/**
 * Eight columns became seven.
 *
 * Status and Active were two columns carrying two badges about the same thing,
 * so they share one cell. The "Output: parent product stock" line under every
 * product name went to the drawer, where it is a labelled field rather than a
 * sentence repeated down a column.
 */
export function RecipesTable({ onView, recipes, ...actions }: RecipesListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipe</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Yield</TableHead>
          <TableHead className="text-right">Cost per unit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recipes.map((recipe) => (
          // The row opens the drawer; the name is also a button so the keyboard
          // has a focusable target for the same action.
          <TableRow
            className={`cursor-pointer ${recipe.status === "archived" ? "opacity-65" : ""}`}
            key={recipe.id}
            onClick={() => onView(recipe)}
          >
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(recipe);
                }}
                type="button"
              >
                <span className="font-medium">{recipe.recipeName}</span>
                <span className="font-mono text-meta text-foreground-muted">
                  {recipe.recipeCode} · v{recipe.versionNumber}
                </span>
              </button>
            </TableCell>
            <TableCell>{recipeOutputLabel(recipe)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {recipe.batchYieldQuantity} {recipe.batchYieldUnitName}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatRecipeMoney(recipe.costPerYieldUnit)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <RecipeStatusBadge status={recipe.status} />
                {recipe.isActive ? <Badge>Active BOM</Badge> : null}
              </div>
            </TableCell>
            <TableCell className="tabular-nums">{formatRecipeDate(recipe.updatedAt)}</TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <RecipeActionsMenu {...actions} recipe={recipe} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
