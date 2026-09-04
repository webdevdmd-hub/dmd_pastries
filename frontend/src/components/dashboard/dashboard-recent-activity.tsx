import type { JSX } from "react";

import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api/client";
import type { DashboardActivity } from "@/types/dashboard";

function formatDate(value: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DashboardRecentActivity({
  activities,
  error,
  isLoading,
  onRetry,
}: {
  activities: DashboardActivity[] | undefined;
  error: unknown;
  isLoading: boolean;
  onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="bg-card shadow-xs">
      <CardHeader>
        <CardTitle className="text-foreground">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
        ) : null}
        {!error && isLoading ? (
          <p className="text-sm text-foreground-muted">Loading recent activity...</p>
        ) : null}
        {!error && !isLoading && activities && activities.length > 0 ? (
          <div className="scrollbar-hidden max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {activities.map((activity, index) => (
              <article
                className="rounded-lg border border-border bg-muted/60 p-4"
                key={`${activity.activityType}-${activity.referenceNumber}-${activity.createdAt}-${String(index)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{activity.title || "Activity"}</p>
                  {activity.referenceNumber ? (
                    <span className="rounded-full border border-brand-cinnamon/30 bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
                      {activity.referenceNumber}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-foreground-muted">
                  {activity.description}
                </p>
                <p className="mt-2 text-xs text-foreground-muted">
                  {activity.createdBy || "System"} - {formatDate(activity.createdAt)}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        {!error && !isLoading && (!activities || activities.length === 0) ? (
          <DashboardEmptyState message="No recent activity found." />
        ) : null}
      </CardContent>
    </Card>
  );
}
