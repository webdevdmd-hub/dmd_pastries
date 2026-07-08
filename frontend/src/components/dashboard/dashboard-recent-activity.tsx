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
    <Card className="bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle className="text-brand-espresso">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
        ) : null}
        {!error && isLoading ? (
          <p className="text-sm text-brand-mocha">Loading recent activity...</p>
        ) : null}
        {!error && !isLoading && activities && activities.length > 0 ? (
          <div className="scrollbar-hidden max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {activities.map((activity, index) => (
              <article
                className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4"
                key={`${activity.activityType}-${activity.referenceNumber}-${activity.createdAt}-${String(index)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand-espresso">
                    {activity.title || "Activity"}
                  </p>
                  {activity.referenceNumber ? (
                    <span className="rounded-full border border-brand-cinnamon/30 bg-white px-2 py-0.5 text-xs font-semibold text-brand-espresso">
                      {activity.referenceNumber}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-brand-mocha">{activity.description}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-mocha">
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
