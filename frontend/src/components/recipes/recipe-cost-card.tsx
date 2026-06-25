"use client";

import type { JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecalculateRecipeCost, useRecipeCost } from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";

export type RecipeLiveCostPreview = {
  batchYieldQuantity: number;
  costPerYieldUnit: number;
  estimatedIngredientCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  hasLines: boolean;
  hasZeroCostComponents: boolean;
  yieldQuantityValid: boolean;
};

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

  if (!recipeId) {
    return (
      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Live cost preview</CardTitle>
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
          <div className="flex justify-between border-t border-brand-cappuccino pt-3">
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
            <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-800">
              Some components have zero cost. Add cost price in Product Master for accurate recipe
              costing.
            </p>
          ) : null}
          {livePreview && !livePreview.yieldQuantityValid ? (
            <p className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-3">
              Enter yield quantity to calculate cost per unit.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Cost breakdown</CardTitle>
        {canRecalculate && recipeId ? (
          <Button
            disabled={recalculateMutation.isPending}
            onClick={() => {
              void recalculate();
            }}
            type="button"
            variant="outline"
          >
            {recalculateMutation.isPending ? "Recalculating..." : "Recalculate"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-brand-mocha">
        <div className="flex justify-between">
          <span>Ingredients</span>
          <strong className="text-brand-espresso">
            {formatCurrency(cost?.estimatedIngredientCost ?? 0)}
          </strong>
        </div>
        <div className="flex justify-between">
          <span>Packaging</span>
          <strong className="text-brand-espresso">
            {formatCurrency(cost?.estimatedPackagingCost ?? 0)}
          </strong>
        </div>
        <div className="flex justify-between border-t border-brand-cappuccino pt-3">
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
      </CardContent>
    </Card>
  );
}
