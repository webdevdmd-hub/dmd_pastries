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
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground">{title}</CardTitle>
        <p className="text-sm leading-6 text-foreground-muted">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-lg border border-border bg-muted/60 p-4" key={metric.label}>
              <span className="mb-4 inline-flex rounded-lg bg-card p-3 text-foreground-muted">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold text-foreground-muted">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{metric.value}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
