import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function DashboardKpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <Card className="overflow-hidden bg-white/85 shadow-soft">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-mocha">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold text-brand-espresso transition-all duration-300">
            {value}
          </p>
        </div>
        <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
