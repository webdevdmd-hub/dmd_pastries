"use client";

import { Pencil } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import { RecipeStatusBadge } from "@/components/recipes/recipe-status-badge";
import { FormTabs } from "@/components/shared/form-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRecipeIngredients, useRecipePackaging, useRecipeVersions } from "@/hooks/use-recipes";
import type { Recipe } from "@/types/recipes";

const RECIPE_DRAWER_TABPANEL_ID = "recipe-drawer-tabpanel";

type RecipeDrawerTabKey = "overview" | "ingredients" | "packaging" | "versions";

export function formatRecipeMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatRecipeDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

export function recipeOutputLabel(recipe: Recipe): string {
  return recipe.productVariantName
    ? `${recipe.productName} - ${recipe.productVariantName}`
    : recipe.productName;
}

function Row({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-cell text-foreground-muted">{label}</span>
      <span className="text-right text-cell font-medium">{value}</span>
    </div>
  );
}

/** One heading for a list that may be loading, failed, or genuinely empty. */
function ListState({
  emptyMessage,
  error,
  isLoading,
}: {
  emptyMessage: string;
  error: unknown;
  isLoading: boolean;
}): JSX.Element {
  return (
    <p className="text-cell text-foreground-muted">
      {isLoading ? "Loading..." : error ? "This list could not be loaded." : emptyMessage}
    </p>
  );
}

/**
 * A recipe, over the list.
 *
 * This drawer already existed and nothing ever opened it: the table's only
 * "view" action pushed straight to the builder page, so a reader who wanted to
 * check a yield or a cost had to load the whole editor. It now opens on a row
 * click, and it carries the BOM lines rather than six cost figures and a link.
 *
 * Editing opens the builder as a dialog over this list rather than navigating
 * to /recipes/[id], so closing it returns the operator to the row they came
 * from. The route still resolves for anyone arriving by URL.
 *
 * Tab state is in memory and the tabs are buttons, not links: /recipes/[id] is
 * the editor, so there is no read-only URL to hand out for a tab.
 */
export function RecipeDetailsDrawer({
  canManage,
  onEdit,
  onOpenChange,
  open,
  recipe,
}: {
  canManage: boolean;
  /** Closes the drawer and opens the host's builder dialog. */
  onEdit: (recipe: Recipe) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  recipe: Recipe | null;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<RecipeDrawerTabKey>("overview");
  const recipeId = recipe?.id ?? null;
  // Only the open drawer fetches, and only for the row it is showing.
  const ingredientsQuery = useRecipeIngredients(recipeId, open && recipeId !== null);
  const packagingQuery = useRecipePackaging(recipeId, open && recipeId !== null);
  const versionsQuery = useRecipeVersions(recipeId, open && recipeId !== null);

  const ingredients = ingredientsQuery.data ?? [];
  const packaging = packagingQuery.data ?? [];
  const versions = versionsQuery.data ?? [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
        {recipe ? (
          // Keyed by recipe: opening a different row resets the tab.
          <div className="grid min-w-0 gap-6" key={recipe.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{recipe.recipeName}</SheetTitle>
              <SheetDescription className="sr-only">
                Recipe overview, bill of materials and version history.
              </SheetDescription>
              <p className="mt-1 font-mono text-meta text-foreground-muted">
                {recipe.recipeCode} · v{recipe.versionNumber}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RecipeStatusBadge status={recipe.status} />
                <Badge variant={recipe.isActive ? "default" : "outline"}>
                  {recipe.isActive ? "Active BOM" : "Not active"}
                </Badge>
              </div>
              {canManage ? (
                <div className="mt-3">
                  {/* The builder opens over the list, so closing it returns
                      the operator to the row they came from. */}
                  <Button onClick={() => onEdit(recipe)} size="sm" type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Edit in builder
                  </Button>
                </div>
              ) : null}
            </SheetHeader>

            <FormTabs
              active={activeTab}
              aria-label="Recipe sections"
              onTabChange={setActiveTab}
              panelId={RECIPE_DRAWER_TABPANEL_ID}
              tabs={[
                { key: "overview", label: "Overview" },
                { key: "ingredients", label: "Ingredients", badge: ingredients.length },
                { key: "packaging", label: "Packaging", badge: packaging.length },
                { key: "versions", label: "Versions", badge: versions.length },
              ]}
            />

            <div className="min-w-0" id={RECIPE_DRAWER_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
              {activeTab === "overview" ? (
                <div className="grid gap-4">
                  <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                    <Row label="Output" value={recipeOutputLabel(recipe)} />
                    <Row
                      label="Stock target"
                      value={recipe.productVariantName ? "Variant" : "Parent product"}
                    />
                    <Row
                      label="Batch yield"
                      value={
                        <span className="tabular-nums">
                          {recipe.batchYieldQuantity} {recipe.batchYieldUnitName}
                        </span>
                      }
                    />
                    <Row
                      label="Preparation"
                      value={
                        recipe.preparationTimeMinutes === null ? (
                          "Not set"
                        ) : (
                          <span className="tabular-nums">{recipe.preparationTimeMinutes} min</span>
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                    <Row
                      label="Ingredient cost"
                      value={
                        <span className="tabular-nums">
                          {formatRecipeMoney(recipe.estimatedIngredientCost)}
                        </span>
                      }
                    />
                    <Row
                      label="Packaging cost"
                      value={
                        <span className="tabular-nums">
                          {formatRecipeMoney(recipe.estimatedPackagingCost)}
                        </span>
                      }
                    />
                    <Row
                      label="Batch total"
                      value={
                        <span className="tabular-nums">
                          {formatRecipeMoney(recipe.estimatedTotalCost)}
                        </span>
                      }
                    />
                    <Row
                      label="Cost per unit"
                      value={
                        <span className="tabular-nums">
                          {formatRecipeMoney(recipe.costPerYieldUnit)}
                        </span>
                      }
                    />
                  </div>

                  {recipe.description ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-meta text-foreground-muted">Description</p>
                      <p className="mt-1 text-cell">{recipe.description}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "ingredients" ? (
                <div className="grid gap-2">
                  {ingredients.length === 0 ? (
                    <ListState
                      emptyMessage="No ingredient lines are defined for this recipe."
                      error={ingredientsQuery.error}
                      isLoading={ingredientsQuery.isLoading}
                    />
                  ) : (
                    ingredients.map((line) => (
                      <div
                        className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                        key={line.id}
                      >
                        <div className="min-w-0">
                          <p className="text-cell font-medium">
                            {line.componentProductName ?? line.itemNameSnapshot}
                          </p>
                          <p className="text-meta tabular-nums text-foreground-muted">
                            {line.quantityRequired} {line.unitSymbol}
                            {line.wastagePercentage > 0
                              ? ` · ${String(line.wastagePercentage)}% wastage`
                              : ""}
                          </p>
                        </div>
                        <span className="text-cell font-medium tabular-nums">
                          {formatRecipeMoney(line.totalCost)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {activeTab === "packaging" ? (
                <div className="grid gap-2">
                  {packaging.length === 0 ? (
                    <ListState
                      emptyMessage="No packaging lines are defined for this recipe."
                      error={packagingQuery.error}
                      isLoading={packagingQuery.isLoading}
                    />
                  ) : (
                    packaging.map((line) => (
                      <div
                        className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                        key={line.id}
                      >
                        <div className="min-w-0">
                          <p className="text-cell font-medium">
                            {line.componentProductName ?? line.packagingNameSnapshot}
                            {line.isOptional ? (
                              <span className="ml-2 text-meta text-foreground-muted">Optional</span>
                            ) : null}
                          </p>
                          <p className="text-meta tabular-nums text-foreground-muted">
                            {line.quantityRequired} {line.unitSymbol}
                          </p>
                        </div>
                        <span className="text-cell font-medium tabular-nums">
                          {formatRecipeMoney(line.totalCost)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {activeTab === "versions" ? (
                <div className="grid gap-2">
                  {versions.length === 0 ? (
                    <ListState
                      emptyMessage="This recipe has no other versions."
                      error={versionsQuery.error}
                      isLoading={versionsQuery.isLoading}
                    />
                  ) : (
                    // A version row is a history entry, not another recipe, so
                    // it carries its change note and author rather than a link.
                    versions.map((version) => (
                      <div
                        className="rounded-lg border border-border bg-card px-4 py-3"
                        key={version.id}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <p className="text-cell font-medium tabular-nums">
                            v{version.versionNumber}
                            {version.versionNumber === recipe.versionNumber ? (
                              <span className="ml-2 text-meta font-normal text-foreground-muted">
                                This version
                              </span>
                            ) : null}
                          </p>
                          <p className="text-meta tabular-nums text-foreground-muted">
                            {formatRecipeDate(version.createdAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-cell text-foreground-muted">
                          {version.changeNote ?? "No change note."}
                        </p>
                        <p className="mt-0.5 text-meta text-foreground-muted">
                          {version.createdByUserName}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Recipe</SheetTitle>
            <SheetDescription>No recipe selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
