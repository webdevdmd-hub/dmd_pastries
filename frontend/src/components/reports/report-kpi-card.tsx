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

/**
 * One report figure.
 *
 * The value never wraps. It used to carry `break-words` at 28px inside a 160px
 * card, so "AED 10,772.50" came apart into "AE / 10, / 77. / 5" down four
 * lines — and because siblings stretch to the tallest, one long figure made
 * every card on the row three times taller than it needed to be. The card is
 * sized from its content instead, and the row it sits in scrolls.
 */
export function ReportKpiCard({
  changePercentage,
  icon: Icon,
  label,
  tone = "default",
  trend,
  value,
}: {
  changePercentage?: number;
  /** Optional: a reconciliation figure reads better without one. */
  icon?: LucideIcon | undefined;
  label: string;
  /**
   * "danger" for a figure whose non-zero value is the problem -- an unreconciled
   * difference, a mismatch count. Semantic, not decorative: a zero difference
   * stays neutral, so colour here means "look at this" rather than "this is a
   * money figure".
   */
  tone?: "danger" | "default" | undefined;
  trend?: ReportTrend;
  value: string;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-meta whitespace-nowrap leading-tight text-foreground-muted">{label}</p>
          <p
            className={`text-title mt-1.5 whitespace-nowrap font-mono tabular-nums lg:text-kpi ${
              tone === "danger" ? "text-danger-text" : "text-foreground"
            }`}
          >
            {value}
          </p>
          {changePercentage !== undefined ? (
            <p className="text-meta mt-1.5 whitespace-nowrap text-foreground-muted">
              {trendLabel(trend)} by {String(changePercentage)}%
            </p>
          ) : null}
        </div>
        {/* The first thing to go when the row is tight: it names nothing the
            label does not already say. */}
        {Icon ? (
          <span className="hidden shrink-0 rounded-lg bg-muted p-2.5 text-foreground-muted lg:inline-flex">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
