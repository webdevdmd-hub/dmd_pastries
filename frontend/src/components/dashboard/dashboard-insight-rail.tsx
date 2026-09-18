"use client";

import type { JSX } from "react";
import { useMemo } from "react";

import { DashboardAlertsPanel } from "@/components/dashboard/dashboard-alerts-panel";
import type { DashboardQuickAction } from "@/components/dashboard/dashboard-quick-actions";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";
import { PERMISSIONS } from "@/constants/permissions";
import { useDashboardAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { usePermission } from "@/hooks/use-permission";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";

export function DashboardInsightRail({
  actions,
  canLoad,
}: {
  actions: DashboardQuickAction[];
  canLoad: boolean;
}): JSX.Element {
  const { hasPermission } = usePermission();
  // The feed is the audit trail; it needs audit_logs.view like the Audit
  // Logs page does, not just dashboard.view (ISSUE-067).
  const canViewActivity = hasPermission(PERMISSIONS.auditLogsView);
  const timezone = useMemo(resolveDashboardTimezone, []);
  const alertsQuery = useDashboardAlerts({ timezone }, canLoad);
  const activityQuery = useRecentActivity(canLoad && canViewActivity);

  return (
    <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
      <DashboardQuickActions actions={actions} />
      <DashboardAlertsPanel
        alerts={alertsQuery.data}
        error={alertsQuery.error}
        isLoading={alertsQuery.isLoading}
        onRetry={() => void alertsQuery.refetch()}
      />
      {canViewActivity ? (
        <DashboardRecentActivity
          activities={activityQuery.data}
          error={activityQuery.error}
          isLoading={activityQuery.isLoading}
          onRetry={() => void activityQuery.refetch()}
        />
      ) : null}
    </aside>
  );
}
