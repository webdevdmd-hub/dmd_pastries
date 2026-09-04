import type { JSX } from "react";

import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api/client";
import type { DashboardAlert } from "@/types/dashboard";

function severityClass(severity: DashboardAlert["severity"]): string {
  if (severity === "critical") return "border-danger/30 bg-danger-tint text-danger-text";
  if (severity === "warning") return "border-warning/30 bg-warning-tint text-warning-text";
  return "border-border bg-muted/70 text-foreground";
}

export function DashboardAlertsPanel({
  alerts,
  error,
  isLoading,
  onRetry,
}: {
  alerts: DashboardAlert[] | undefined;
  error: unknown;
  isLoading: boolean;
  onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="bg-card shadow-xs">
      <CardHeader>
        <CardTitle className="text-foreground">Operational Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
        ) : null}
        {!error && isLoading ? (
          <p className="text-sm text-foreground-muted">Loading alerts...</p>
        ) : null}
        {!error && !isLoading && alerts && alerts.length > 0
          ? alerts.map((alert) => (
              <article
                className={`rounded-lg border p-4 ${severityClass(alert.severity)}`}
                key={`${alert.alertType}-${alert.referenceId}-${alert.title}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{alert.title || "Dashboard alert"}</p>
                    <p className="mt-1 text-sm leading-6">{alert.description}</p>
                  </div>
                  <span className="text-xs font-semibold">{alert.severity}</span>
                </div>
              </article>
            ))
          : null}
        {!error && !isLoading && (!alerts || alerts.length === 0) ? (
          <DashboardEmptyState message="No active dashboard alerts." />
        ) : null}
      </CardContent>
    </Card>
  );
}
