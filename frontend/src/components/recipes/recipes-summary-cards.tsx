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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card className="bg-card/80" key={card.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-3 text-3xl font-medium text-brand-espresso">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-brand-cappuccino/35 p-4 text-brand-mocha">
                <Icon className="h-7 w-7" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
