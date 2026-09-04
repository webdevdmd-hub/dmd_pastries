import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export type KpiDelta = {
  /** Signed percentage change. 12.4 renders as +12.4%. */
  percentage: number;
  /** What it is a change against, e.g. "vs previous day". Rendered verbatim. */
  comparedTo: string;
};

/**
 * A KPI: the figure, how it moved, and what it is.
 *
 * The delta is optional and stays absent unless a real comparison exists. The
 * reference template shows a percentage on every card, but the dashboard API
 * returns current-period figures only -- there is no previous-period value to
 * divide by for most of these. A card with no delta renders no delta rather
 * than a plausible-looking one.
 */
export function DashboardKpiCard({
  caption,
  delta,
  icon: Icon,
  label,
  value,
}: {
  caption?: string | undefined;
  delta?: KpiDelta | undefined;
  icon: LucideIcon;
  label: string;
  value: string;
}): JSX.Element {
  const isUp = delta ? delta.percentage >= 0 : false;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-foreground-muted" />
            <p className="text-meta truncate text-foreground-muted">{label}</p>
          </div>
          {delta ? (
            <span
              className={`text-meta inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums ${
                isUp ? "bg-money-tint text-money-text" : "bg-danger-tint text-danger-text"
              }`}
            >
              <DeltaIcon aria-hidden="true" className="h-3 w-3" />
              {isUp ? "+" : ""}
              {delta.percentage.toFixed(1)}%
            </span>
          ) : null}
        </div>

        <p className="text-total break-words font-mono tabular-nums text-foreground">{value}</p>

        {delta ? (
          <p className="text-meta text-foreground-muted">
            {isUp ? "Up" : "Down"} {Math.abs(delta.percentage).toFixed(1)}% {delta.comparedTo}
          </p>
        ) : caption ? (
          <p className="text-meta text-foreground-muted">{caption}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
