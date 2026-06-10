import { CheckCircle2, Factory, PackageCheck, Timer } from "lucide-react";
import type { JSX } from "react";

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
    { icon: Factory, label: "Total Batches", meta: "total", value: String(data.totalBatches) },
    { icon: Timer, label: "In Progress", meta: "active", value: String(data.inProgressBatches) },
    {
      icon: CheckCircle2,
      label: "Completed",
      meta: "closed",
      value: String(data.completedBatches),
    },
    {
      icon: PackageCheck,
      label: "Production Output",
      meta: "units",
      value: String(data.totalProductionOutput),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <section
            className="rounded-2xl border border-neutral-300 bg-white p-5 text-neutral-950"
            key={card.label}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {card.label}
                </p>
                <div className="mt-4 flex items-end gap-2">
                  <p className="font-mono text-4xl font-semibold leading-none text-neutral-950">
                    {card.value}
                  </p>
                  <p className="pb-1 text-sm text-neutral-500">{card.meta}</p>
                </div>
              </div>
              <span className="rounded-full border border-neutral-300 bg-neutral-50 p-2 text-neutral-700">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
