import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";

export type DashboardKpi = {
  icon: LucideIcon;
  label: string;
  value: string;
};

export function DashboardKpiGrid({ items }: { items: DashboardKpi[] }): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <DashboardKpiCard icon={item.icon} key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
