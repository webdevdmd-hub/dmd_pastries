import { ArrowDownToLine, ArrowUpFromLine, ChartNoAxesCombined, ListChecks } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { MovementSummary } from "@/types/stock-movements";

type MovementsSummaryCardsProps = {
  summary: MovementSummary | undefined;
};

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
}

export function MovementsSummaryCards({ summary }: MovementsSummaryCardsProps): JSX.Element {
  const cards = [
    {
      label: "Total In Quantity",
      value: formatQuantity(summary?.totalInQuantity ?? 0),
      icon: ArrowDownToLine,
    },
    {
      label: "Total Out Quantity",
      value: formatQuantity(summary?.totalOutQuantity ?? 0),
      icon: ArrowUpFromLine,
    },
    {
      label: "Net Quantity",
      value: formatQuantity(summary?.netQuantity ?? 0),
      icon: ChartNoAxesCombined,
    },
    {
      label: "Movement Count",
      value: String(summary?.movementCount ?? 0),
      icon: ListChecks,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-brand-mocha">{card.label}</p>
              <p className="mt-2 text-3xl font-medium text-brand-espresso">{card.value}</p>
            </div>
            <div className="rounded-2xl bg-brand-cappuccino/35 p-3 text-brand-mocha">
              <card.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
