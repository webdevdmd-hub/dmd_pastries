"use client";

import type { JSX, ReactNode } from "react";

import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api/client";

export function DashboardChartCard({
  children,
  description,
  error,
  hasData,
  isLoading,
  onRetry,
  title,
}: {
  children: ReactNode;
  description: string;
  error: unknown;
  hasData: boolean;
  isLoading: boolean;
  onRetry: () => void;
  title: string;
}): JSX.Element {
  return (
    <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/90 shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-brand-espresso">{title}</CardTitle>
        <p className="text-sm leading-6 text-brand-mocha">{description}</p>
      </CardHeader>
      <CardContent>
        {error ? (
          <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
        ) : null}
        {!error && isLoading ? (
          <div className="h-72 animate-pulse rounded-3xl bg-brand-latte/80" />
        ) : null}
        {!error && !isLoading && !hasData ? (
          <DashboardEmptyState message="No chart data available for this period." />
        ) : null}
        {!error && !isLoading && hasData ? children : null}
      </CardContent>
    </Card>
  );
}
