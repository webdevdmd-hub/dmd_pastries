import type { JSX, ReactNode } from "react";

import { ReportChartSkeleton } from "@/components/reports/report-chart-skeleton";
import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportErrorState } from "@/components/reports/report-error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api/client";

type ReportChartCardProps = {
  caption: string;
  children: ReactNode;
  error: Error | null;
  isEmpty: boolean;
  isLoading: boolean;
  onRetry: () => void;
  title: string;
};

export function ReportChartCard({
  caption,
  children,
  error,
  isEmpty,
  isLoading,
  onRetry,
  title,
}: ReportChartCardProps): JSX.Element {
  return (
    <Card className="bg-card/85 shadow-soft">
      <CardHeader>
        <CardTitle className="text-brand-espresso">{title}</CardTitle>
        <p className="text-sm text-brand-mocha">{caption}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? <ReportChartSkeleton /> : null}
        {error ? <ReportErrorState description={getErrorMessage(error)} onRetry={onRetry} /> : null}
        {!isLoading && !error && isEmpty ? (
          <ReportEmptyState message="No chart data returned for this filter range." />
        ) : null}
        {!isLoading && !error && !isEmpty ? children : null}
      </CardContent>
    </Card>
  );
}
