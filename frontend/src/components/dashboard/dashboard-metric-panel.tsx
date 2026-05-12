import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DashboardMetric = {
  icon: LucideIcon;
  label: string;
  value: string;
};

export function DashboardMetricPanel({
  description,
  metrics,
  title,
}: {
  description: string;
  metrics: DashboardMetric[];
  title: string;
}): JSX.Element {
  return (
    <Card className="border-brand-cappuccino/70 bg-white/90 shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-brand-espresso">{title}</CardTitle>
        <p className="text-sm leading-6 text-brand-mocha">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              className="rounded-3xl border border-brand-cappuccino/60 bg-brand-latte/60 p-4"
              key={metric.label}
            >
              <span className="mb-4 inline-flex rounded-2xl bg-white/80 p-3 text-brand-mocha">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-mocha">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-espresso">{metric.value}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
