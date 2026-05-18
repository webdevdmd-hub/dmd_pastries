"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { RecipeActionsMenu } from "@/components/recipes/recipe-actions-menu";
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
import { ROUTES } from "@/constants/routes";
import type { Recipe, RecipeStatus } from "@/types/recipes";

type RecipesTableProps = {
  canManage: boolean;
  onCreateVersion: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onStatusChange: (recipe: Recipe, status: RecipeStatus, isActive?: boolean) => void;
  recipes: Recipe[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

function recipeOutputLabel(recipe: Recipe): string {
  return recipe.productVariantName
    ? `${recipe.productName} - ${recipe.productVariantName}`
    : recipe.productName;
}

export function RecipesTable({
  canManage,
  onCreateVersion,
  onDelete,
  onStatusChange,
  recipes,
}: RecipesTableProps): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipe</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Yield</TableHead>
          <TableHead>Cost per Unit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Updated At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recipes.map((recipe) => (
          <TableRow className={recipe.status === "archived" ? "opacity-65" : ""} key={recipe.id}>
            <TableCell>
              <Link className="grid gap-1" href={`${ROUTES.recipes}/${recipe.id}`}>
                <span className="font-semibold text-brand-espresso">{recipe.recipeName}</span>
                <span className="text-xs text-brand-mocha">
                  {recipe.recipeCode} · v{recipe.versionNumber}
                </span>
              </Link>
            </TableCell>
            <TableCell>
              <div className="grid gap-1">
                <span>{recipeOutputLabel(recipe)}</span>
                <span className="text-xs text-brand-mocha">
                  Output: {recipe.productVariantName ? "Variant stock" : "Parent product stock"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {recipe.batchYieldQuantity} {recipe.batchYieldUnitName}
            </TableCell>
            <TableCell>{formatCurrency(recipe.costPerYieldUnit)}</TableCell>
            <TableCell>
              <RecipeStatusBadge status={recipe.status} />
            </TableCell>
            <TableCell>
              <Badge variant={recipe.isActive ? "default" : "outline"}>
                {recipe.isActive ? "Active BOM" : "Not active"}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(recipe.updatedAt)}</TableCell>
            <TableCell>
              <RecipeActionsMenu
                canManage={canManage}
                onCreateVersion={onCreateVersion}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onView={(selectedRecipe) => router.push(`${ROUTES.recipes}/${selectedRecipe.id}`)}
                recipe={recipe}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
