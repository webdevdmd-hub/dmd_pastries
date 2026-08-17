"use client";

import type { JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecalculateRecipeCost, useRecipeCost } from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import type { RecipeLiveCostPreview } from "@/lib/recipes/recipe-cost-preview";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function RecipeCostCard({
  canRecalculate,
  draftIngredientCount = 0,
  draftPackagingCount = 0,
  livePreview,
  recipeId,
}: {
  canRecalculate: boolean;
  draftIngredientCount?: number;
  draftPackagingCount?: number;
  livePreview?: RecipeLiveCostPreview;
  recipeId: string | null;
}): JSX.Element {
  const costQuery = useRecipeCost(recipeId, recipeId !== null);
  const recalculateMutation = useRecalculateRecipeCost();
  const cost = costQuery.data;

  const recalculate = async (): Promise<void> => {
    if (!recipeId) {
      return;
    }

    try {
      await recalculateMutation.mutateAsync(recipeId);
      toast.success("Recipe cost recalculated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Live cost preview</CardTitle>
        {canRecalculate && recipeId ? (
          <Button
            disabled={recalculateMutation.isPending}
            onClick={() => {
              void recalculate();
            }}
            type="button"
            variant="outline"
          >
            {recalculateMutation.isPending ? "Refreshing..." : "Refresh saved cost"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-brand-mocha">
        <div className="flex justify-between">
          <span>Ingredient lines</span>
          <strong className="text-brand-espresso">{draftIngredientCount}</strong>
        </div>
        <div className="flex justify-between">
          <span>Packaging lines</span>
          <strong className="text-brand-espresso">{draftPackagingCount}</strong>
        </div>
        <div className="flex justify-between">
          <span>Ingredients</span>
          <strong className="text-brand-espresso">
            {formatCurrency(livePreview?.estimatedIngredientCost ?? 0)}
          </strong>
        </div>
        <div className="flex justify-between">
          <span>Packaging</span>
          <strong className="text-brand-espresso">
            {formatCurrency(livePreview?.estimatedPackagingCost ?? 0)}
          </strong>
        </div>
        <div className="flex justify-between border-t border-brand-cappuccino pt-3">
          <span>Total</span>
          <strong className="text-brand-espresso">
            {formatCurrency(livePreview?.estimatedTotalCost ?? 0)}
          </strong>
        </div>
        <div className="flex justify-between">
          <span>Cost per yield unit</span>
          <strong className="text-brand-espresso">
            {formatCurrency(livePreview?.costPerYieldUnit ?? 0)}
          </strong>
        </div>
        {!livePreview?.hasLines ? (
          <p className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-3">
            Add ingredients or packaging to preview recipe cost.
          </p>
        ) : null}
        {livePreview?.hasZeroCostComponents ? (
          <p className="rounded-2xl border border-warning/30 bg-warning-tint p-3 text-warning-text">
            Some components have zero cost. Add cost price in Product Master for accurate recipe
            costing.
          </p>
        ) : null}
        {livePreview?.hasUnitMismatch ? (
          <p className="rounded-2xl border border-warning/30 bg-warning-tint p-3 text-warning-text">
            Some component units differ from Product Master. Backend costing requires the component
            unit to match because unit conversion is not available yet.
          </p>
        ) : null}
        {livePreview && !livePreview.yieldQuantityValid ? (
          <p className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-3">
            Enter yield quantity to calculate cost per unit.
          </p>
        ) : null}
        {recipeId ? (
          <div className="grid gap-2 border-t border-brand-cappuccino pt-3 text-xs">
            <p className="font-semibold text-brand-espresso">Saved backend cost</p>
            <div className="flex justify-between">
              <span>Total</span>
              <strong className="text-brand-espresso">
                {formatCurrency(cost?.estimatedTotalCost ?? 0)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Cost per yield unit</span>
              <strong className="text-brand-espresso">
                {formatCurrency(cost?.costPerYieldUnit ?? 0)}
              </strong>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
