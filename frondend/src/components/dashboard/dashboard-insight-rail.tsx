"use client";

import type { JSX } from "react";

import { DashboardAlertsPanel } from "@/components/dashboard/dashboard-alerts-panel";
import type { DashboardQuickAction } from "@/components/dashboard/dashboard-quick-actions";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";
import { useDashboardAlerts, useRecentActivity } from "@/hooks/use-dashboard";

export function DashboardInsightRail({
  actions,
  canLoad,
}: {
  actions: DashboardQuickAction[];
  canLoad: boolean;
}): JSX.Element {
  const alertsQuery = useDashboardAlerts(canLoad);
  const activityQuery = useRecentActivity(canLoad);

  return (
    <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
      <DashboardQuickActions actions={actions} />
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
    </aside>
  );
}
