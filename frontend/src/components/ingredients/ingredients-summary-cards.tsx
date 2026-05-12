import { AlertTriangle, Boxes, CircleCheck, Wheat } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { Ingredient } from "@/types/ingredient";

type IngredientsSummaryCardsProps = {
  items: Ingredient[];
};

const cards = [
  { icon: Wheat, key: "total", label: "Total Ingredients" },
  { icon: CircleCheck, key: "active", label: "Active Ingredients" },
  { icon: Boxes, key: "tracked", label: "Stock Tracked" },
  { icon: AlertTriangle, key: "low", label: "Low Stock Watch" },
] as const;

export function IngredientsSummaryCards({ items }: IngredientsSummaryCardsProps): JSX.Element {
  const stats = {
    active: items.filter((item) => item.status === "active").length,
    low: items.filter((item) => item.isStockTracked && item.reorderLevel > 0).length,
    total: items.length,
    tracked: items.filter((item) => item.isStockTracked).length,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-brand-espresso">{stats[card.key]}</p>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-latte text-brand-mocha">
                <Icon className="h-6 w-6" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
