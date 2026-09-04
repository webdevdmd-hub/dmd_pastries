"use client";

import type { JSX, ReactNode } from "react";

import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api/client";

/**
 * A chart in a card, with its controls in the header.
 *
 * `actions` is the reference template's period select and Export button: on a
 * dashboard the control that changes what a chart shows belongs beside its
 * title, not floating above the card where it reads as page-level.
 */
export function DashboardChartCard({
  actions,
  children,
  description,
  error,
  hasData,
  isLoading,
  onRetry,
  title,
}: {
  actions?: ReactNode | undefined;
  children: ReactNode;
  description: string;
  error: unknown;
  hasData: boolean;
  isLoading: boolean;
  onRetry: () => void;
  title: string;
}): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-section font-medium text-foreground">{title}</CardTitle>
          <p className="text-meta mt-1 text-foreground-muted">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
        ) : null}
        {!error && isLoading ? <div className="h-72 animate-pulse rounded-lg bg-muted" /> : null}
        {!error && !isLoading && !hasData ? (
          <DashboardEmptyState message="No chart data available for this period." />
        ) : null}
        {!error && !isLoading && hasData ? children : null}
      </CardContent>
    </Card>
  );
}
