"use client";

import { Activity, Calculator, ClipboardList, TimerReset } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { Recipe } from "@/types/recipes";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function RecipesSummaryCards({ recipes }: { recipes: Recipe[] }): JSX.Element {
  const active = recipes.filter((recipe) => recipe.isActive || recipe.status === "active").length;
  const avgCost =
    recipes.length > 0
      ? recipes.reduce((sum, recipe) => sum + recipe.costPerYieldUnit, 0) / recipes.length
      : 0;
  const recent = recipes.filter((recipe) => {
    const updated = new Date(recipe.updatedAt).getTime();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return Number.isFinite(updated) && updated >= weekAgo;
  }).length;
  const cards = [
    { label: "Total Recipes", value: String(recipes.length), icon: ClipboardList },
    { label: "Active Recipes", value: String(active), icon: Activity },
    { label: "Avg Cost per Unit", value: formatCurrency(avgCost), icon: Calculator },
    { label: "Recently Updated", value: String(recent), icon: TimerReset },
  ];

  return (
    // Four across from md, not from xl. The old xl threshold meant a laptop at
    // any width under 1280px got two rows of two, which is most laptops: the
    // four figures are one comparison and belong on one line.
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label}>
            {/* Padding and type step up with the viewport instead of staying at
                the widest setting, so four cards fit a 768px row without the
                figure colliding with its icon. */}
            <CardContent className="flex items-center justify-between gap-3 p-4 xl:p-5">
              <div className="min-w-0">
                <p className="truncate text-meta text-foreground-muted">{card.label}</p>
                <p className="mt-2 truncate text-2xl font-medium tabular-nums text-foreground xl:text-3xl">
                  {card.value}
                </p>
              </div>
              {/* The icon is decoration, and decoration is the first thing to
                  go when the row is tight. */}
              <div className="hidden shrink-0 rounded-xl bg-border/35 p-2.5 text-foreground-muted sm:block xl:p-3">
                <Icon className="h-5 w-5 xl:h-6 xl:w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
