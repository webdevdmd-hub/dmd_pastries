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
    <Card className="bg-card/85 shadow-soft">
      <CardContent className="flex items-start justify-between gap-3 p-4 md:p-5">
        <div className="min-w-0">
          <p className="text-cell leading-tight text-brand-mocha">{label}</p>
          <p className="mt-2 break-words text-kpi tabular-nums text-brand-espresso">{value}</p>
          {changePercentage !== undefined ? (
            <p className="mt-2 text-meta text-brand-mocha">
              {trendLabel(trend)} by {String(changePercentage)}%
            </p>
          ) : null}
        </div>
        {/* Two cards share a phone's width; the icon is the first thing to go. */}
        <span className="hidden shrink-0 rounded-2xl bg-brand-latte p-3 text-brand-mocha sm:inline-flex">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}
