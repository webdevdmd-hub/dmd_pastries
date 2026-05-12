"use client";

import type { JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecalculateRecipeCost, useRecipeCost } from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function RecipeCostCard({
  canManage,
  recipeId,
}: {
  canManage: boolean;
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
    <Card className="bg-white/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Cost breakdown</CardTitle>
        {canManage && recipeId ? (
          <Button
            disabled={recalculateMutation.isPending}
            onClick={() => {
              void recalculate();
            }}
            type="button"
            variant="outline"
          >
            Recalculate
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
