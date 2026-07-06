"use client";

import type { JSX, ReactNode } from "react";
import { useMemo } from "react";

import { DashboardAlertsPanel } from "@/components/dashboard/dashboard-alerts-panel";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";
import { useDashboardAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";

export function DashboardPageShell({
  children,
  canLoad,
}: {
  canLoad: boolean;
  children: ReactNode;
}): JSX.Element {
  const timezone = useMemo(resolveDashboardTimezone, []);
  const alertsQuery = useDashboardAlerts({ timezone }, canLoad);
  const activityQuery = useRecentActivity(canLoad);
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="space-y-6">{children}</div>
      <div className="space-y-6">
        <DashboardAlertsPanel
          alerts={alertsQuery.data}
          error={alertsQuery.error}
          isLoading={alertsQuery.isLoading}
          onRetry={() => void alertsQuery.refetch()}
        />
        <DashboardRecentActivity
          activities={activityQuery.data}
          error={activityQuery.error}
          isLoading={activityQuery.isLoading}
          onRetry={() => void activityQuery.refetch()}
        />
      </div>
    </div>
  );
}
