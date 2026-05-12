import { CheckCircle2, Factory, PackageCheck, Timer } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { ManufacturingSummary } from "@/types/manufacturing";

const fallbackSummary: ManufacturingSummary = {
  completedBatches: 0,
  inProgressBatches: 0,
  totalBatches: 0,
  totalProductionOutput: 0,
};

export function ManufacturingSummaryCards({
  summary,
}: {
  summary?: ManufacturingSummary | undefined;
}): JSX.Element {
  const data = summary ?? fallbackSummary;
  const cards = [
    { icon: Factory, label: "Total Batches", value: String(data.totalBatches) },
    { icon: Timer, label: "In Progress", value: String(data.inProgressBatches) },
    { icon: CheckCircle2, label: "Completed", value: String(data.completedBatches) },
    {
      icon: PackageCheck,
      label: "Production Output",
      value: String(data.totalProductionOutput),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card className="bg-white/85" key={card.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-brand-espresso">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
