import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { ReportTrend } from "@/types/reports";

function trendLabel(trend: ReportTrend | undefined): string {
  if (trend === "up") {
    return "Trending up";
  }
  if (trend === "down") {
    return "Trending down";
  }
  return "Flat";
}

export function ReportKpiCard({
  changePercentage,
  icon: Icon,
  label,
  trend,
  value,
}: {
  changePercentage?: number;
  icon: LucideIcon;
  label: string;
  trend?: ReportTrend;
  value: string;
}): JSX.Element {
  return (
    <Card className="bg-white/85 shadow-soft">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-mocha">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold text-brand-espresso">{value}</p>
          {changePercentage !== undefined ? (
            <p className="mt-2 text-sm text-brand-mocha">
              {trendLabel(trend)} by {String(changePercentage)}%
            </p>
          ) : null}
        </div>
        <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}
