import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { DashboardKpiCard, type KpiDelta } from "@/components/dashboard/dashboard-kpi-card";

export type DashboardKpi = {
  caption?: string | undefined;
  delta?: KpiDelta | undefined;
  icon: LucideIcon;
  label: string;
  value: string;
};

export function DashboardKpiGrid({ items }: { items: DashboardKpi[] }): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <DashboardKpiCard
          caption={item.caption}
          delta={item.delta}
          icon={item.icon}
          key={item.label}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
}
