import type { JSX } from "react";

export function ReportChartSkeleton(): JSX.Element {
  return (
    <div className="h-72 animate-pulse rounded-2xl border border-brand-cappuccino bg-brand-latte/60" />
  );
}
