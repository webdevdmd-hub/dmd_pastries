"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Factory,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/dashboard/access-denied-card";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import { DashboardDonutChart } from "@/components/dashboard/dashboard-donut-chart";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { DashboardRiskChart } from "@/components/dashboard/dashboard-risk-chart";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardTrendChart } from "@/components/dashboard/dashboard-trend-chart";
import { ReportFilterBar, type ReportFilterDraft } from "@/components/reports/report-filter-bar";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useAdminDashboard, useDashboardAlerts, useRecentActivity } from "@/hooks/use-dashboard";
import { useManufacturingTrend } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import {
  useOrdersChart,
  usePaymentsChart,
  useReportBranches,
  useSalesChart,
} from "@/hooks/use-reports";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import {
  createDefaultDashboardDraft,
  resolveDashboardTimezone,
  toDashboardReportFilters,
} from "@/lib/reports/dashboard-filters";
import { reportBaseFiltersSchema } from "@/lib/validators/reports.schema";
import type { DashboardActivity, DashboardAlert, DashboardLoadWarning } from "@/types/dashboard";
import type { ManufacturingReportFilters } from "@/types/manufacturing-reports";
import type { ReportFilters } from "@/types/reports";

const actions = [
  { href: ROUTES.pos, icon: ReceiptText, label: "Open POS" },
  { href: ROUTES.orders, icon: ShoppingBag, label: "Create bakery order" },
  { href: ROUTES.manufacturing, icon: Factory, label: "Start production" },
  { href: ROUTES.expenses, icon: CreditCard, label: "Record expense" },
] as const;

const performanceViews = ["Sales", "Orders", "Production", "Inventory", "Finance"] as const;
type PerformanceView = (typeof performanceViews)[number];

function hasChartData(
  data: { datasets: { data: number[] }[]; labels: string[] } | undefined,
): boolean {
  return Boolean(
    data && data.labels.length > 0 && data.datasets.some((dataset) => dataset.data.length > 0),
  );
}

function dashboardGroupByToManufacturingGroupBy(
  groupBy: ReportFilters["groupBy"],
): ManufacturingReportFilters["groupBy"] {
  return groupBy === "week" || groupBy === "month" ? groupBy : "day";
}

function toManufacturingTrendFilters(filters: ReportFilters): ManufacturingReportFilters {
  const trendFilters: ManufacturingReportFilters = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const groupBy = dashboardGroupByToManufacturingGroupBy(filters.groupBy);
  if (filters.branchId) trendFilters.branchId = filters.branchId;
  if (groupBy) trendFilters.groupBy = groupBy;
  if (filters.scope) trendFilters.scope = filters.scope;
  if (filters.timezone) trendFilters.timezone = filters.timezone;
  return trendFilters;
}

function detailString(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  return typeof value === "string" ? value.trim() : "";
}

function adminDashboardErrorDescription(error: unknown): string {
  const message = getErrorMessage(error);
  if (!(error instanceof ApiError) || !error.errorDetails) return message;

  const details = error.errorDetails;
  const parts = [
    detailString(details, "segment") ? `Segment: ${detailString(details, "segment")}` : "",
    detailString(details, "reason") ? `Reason: ${detailString(details, "reason")}` : "",
    detailString(details, "scope") ? `Scope: ${detailString(details, "scope")}` : "",
    detailString(details, "branch_id") ? `Branch: ${detailString(details, "branch_id")}` : "",
    detailString(details, "date_from") && detailString(details, "date_to")
      ? `Dates: ${detailString(details, "date_from")} to ${detailString(details, "date_to")}`
      : "",
    detailString(details, "error") ? `Backend: ${detailString(details, "error")}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? `${message} (${parts.join("; ")})` : message;
}

function formatActivityDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function alertHref(alert: DashboardAlert): string {
  if (alert.alertType === "low_stock") return ROUTES.inventoryLowStock;
  if (alert.alertType === "expiry") return ROUTES.inventoryExpiryAlerts;
  if (alert.alertType === "production_delay") return ROUTES.manufacturingBatches;
  if (alert.alertType === "outstanding_payment") return ROUTES.reportsBakeryOrdersPendingPayments;
  return ROUTES.orders;
}

function severityRank(severity: DashboardAlert["severity"]): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function severityStyle(severity: DashboardAlert["severity"]): string {
  if (severity === "critical") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-zinc-400";
}

function DashboardLoadWarningsBanner({
  isRetrying,
  onRetry,
  warnings,
}: {
  isRetrying: boolean;
  onRetry: () => void;
  warnings: DashboardLoadWarning[];
}): JSX.Element | null {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Some dashboard widgets have limited data.</p>
            <ul className="mt-1 space-y-1 text-sm">
              {warnings.map((warning) => (
                <li key={`${warning.segment}-${warning.reason}`}>
                  <span className="font-medium">{warning.segment}:</span> {warning.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button disabled={isRetrying} onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3 border-b border-workspace-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-brand-espresso">{title}</h2>
        <p className="mt-1 text-sm text-workspace-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AttentionQueue({
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
  const orderedAlerts = [...(alerts ?? [])]
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
    .slice(0, 5);
  const criticalCount = alerts?.filter((alert) => alert.severity === "critical").length ?? 0;

  return (
    <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
      <SectionHeader
        action={
          <span className="text-xs font-semibold uppercase text-workspace-muted">
            {criticalCount > 0 ? `${String(criticalCount)} critical` : "Live queue"}
          </span>
        }
        description="Exceptions that need a manager's decision or follow-up."
        title="Requires attention"
      />
      <div>
        {error ? (
          <div className="p-5">
            <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
          </div>
        ) : null}
        {!error && isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((item) => (
              <div className="h-14 animate-pulse bg-zinc-100" key={item} />
            ))}
          </div>
        ) : null}
        {!error && !isLoading && orderedAlerts.length > 0
          ? orderedAlerts.map((alert) => (
              <Link
                className="group grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-4 border-b border-workspace-border px-5 py-3.5 last:border-b-0 hover:bg-zinc-50"
                href={alertHref(alert)}
                key={`${alert.alertType}-${alert.referenceId}-${alert.title}`}
              >
                <span className={`h-9 w-1 rounded-full ${severityStyle(alert.severity)}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-brand-espresso">
                    {alert.title || "Operational alert"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-workspace-muted">
                    {alert.description}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))
          : null}
        {!error && !isLoading && orderedAlerts.length === 0 ? (
          <div className="p-5">
            <DashboardEmptyState message="No active operational alerts." />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ActivityTable({
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
  const rows = activities?.slice(0, 8) ?? [];

  return (
    <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
      <SectionHeader
        description="Recent operational events across the active business scope."
        title="Recent activity"
      />
      {error ? (
        <div className="p-5">
          <DashboardErrorState description={getErrorMessage(error)} onRetry={onRetry} />
        </div>
      ) : null}
      {!error && isLoading ? <div className="m-5 h-36 animate-pulse bg-zinc-100" /> : null}
      {!error && !isLoading && rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase text-workspace-muted">
              <tr>
                <th className="px-5 py-3">Activity</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">User</th>
                <th className="px-5 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((activity, index) => (
                <tr
                  className="border-t border-workspace-border text-brand-espresso"
                  key={`${activity.activityType}-${activity.referenceNumber}-${activity.createdAt}-${String(index)}`}
                >
                  <td className="max-w-sm px-5 py-3">
                    <p className="font-semibold">{activity.title || "Activity"}</p>
                    <p className="mt-0.5 truncate text-xs text-workspace-muted">
                      {activity.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-workspace-muted">
                    {activity.moduleLabel || activity.entityType || "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {activity.referenceNumber || activity.recordLabel || "-"}
                  </td>
                  <td className="px-4 py-3 text-workspace-muted">
                    {activity.createdBy || "System"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-workspace-muted">
                    {formatActivityDate(activity.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!error && !isLoading && rows.length === 0 ? (
        <div className="p-5">
          <DashboardEmptyState message="No recent activity found." />
        </div>
      ) : null}
    </section>
  );
}

export function AdminDashboardClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const [performanceView, setPerformanceView] = useState<PerformanceView>("Sales");
  const canView = hasAnyPermission([
    PERMISSIONS.dashboardView,
    PERMISSIONS.usersView,
    PERMISSIONS.rolesView,
    PERMISSIONS.settingsView,
    PERMISSIONS.reportsView,
  ]);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const timezone = useMemo(resolveDashboardTimezone, []);
  const defaultDraft = useMemo(
    () => createDefaultDashboardDraft(branchScope.defaultBranchId),
    [branchScope.defaultBranchId],
  );
  const [draftFilters, setDraftFilters] = useState<ReportFilterDraft>(defaultDraft);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() =>
    toDashboardReportFilters(defaultDraft, timezone),
  );

  useEffect(() => {
    setDraftFilters(defaultDraft);
    setAppliedFilters(toDashboardReportFilters(defaultDraft, timezone));
  }, [defaultDraft, timezone]);

  const canLoadDashboard = canView && hasScope;
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const dashboardQuery = useAdminDashboard(appliedFilters, canLoadDashboard);
  const alertsQuery = useDashboardAlerts({ timezone }, canLoadDashboard);
  const activityQuery = useRecentActivity(canLoadDashboard);
  const salesChartQuery = useSalesChart(appliedFilters, canLoadDashboard);
  const paymentsChartQuery = usePaymentsChart(appliedFilters, canLoadDashboard);
  const ordersChartQuery = useOrdersChart(appliedFilters, canLoadDashboard);
  const manufacturingTrendFilters = useMemo(
    () => toManufacturingTrendFilters(appliedFilters),
    [appliedFilters],
  );
  const manufacturingTrendQuery = useManufacturingTrend(
    manufacturingTrendFilters,
    canLoadDashboard,
  );

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const handleApply = (): void => {
    const parsed = reportBaseFiltersSchema.safeParse(
      toDashboardReportFilters(draftFilters, timezone),
    );
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Dashboard filters are invalid.");
      return;
    }
    setAppliedFilters(toDashboardReportFilters(draftFilters, timezone));
  };

  const handleReset = (): void => {
    setDraftFilters(defaultDraft);
    setAppliedFilters(toDashboardReportFilters(defaultDraft, timezone));
  };

  const handleRefresh = (): void => {
    void Promise.all([
      dashboardQuery.refetch(),
      alertsQuery.refetch(),
      activityQuery.refetch(),
      salesChartQuery.refetch(),
      paymentsChartQuery.refetch(),
      ordersChartQuery.refetch(),
      manufacturingTrendQuery.refetch(),
    ]);
  };

  const dashboard = dashboardQuery.data;
  const isRefreshing =
    dashboardQuery.isFetching ||
    alertsQuery.isFetching ||
    activityQuery.isFetching ||
    salesChartQuery.isFetching ||
    paymentsChartQuery.isFetching ||
    ordersChartQuery.isFetching ||
    manufacturingTrendQuery.isFetching;

  const inventoryRisk = [
    { label: "Low stock", value: dashboard?.inventory.lowStockCount ?? 0 },
    { label: "Expiring", value: dashboard?.inventory.expiringItems ?? 0 },
    { label: "Out of stock", value: dashboard?.inventory.outOfStock ?? 0 },
  ];
  const decisionMetrics = [
    {
      detail: "Selected period",
      icon: CircleDollarSign,
      label: "Sales",
      value: formatCurrency(dashboard?.sales.todaySales ?? 0),
    },
    {
      detail: "Payments received",
      icon: CreditCard,
      label: "Collections",
      value: formatCurrency(dashboard?.financial.collectedToday ?? 0),
    },
    {
      detail: "Completed sales",
      icon: ReceiptText,
      label: "Sales count",
      value: formatNumber(dashboard?.sales.salesCountToday ?? 0),
    },
    {
      detail: "Per completed sale",
      icon: BarChart3,
      label: "Average order",
      value: formatCurrency(dashboard?.sales.averageOrderValue ?? 0),
    },
    {
      detail: "Open customer balance",
      icon: AlertCircle,
      label: "Outstanding",
      value: formatCurrency(dashboard?.financial.outstandingBalance ?? 0),
    },
  ];
  const healthRows = [
    {
      href: ROUTES.orders,
      label: "Pending orders",
      note: "Awaiting processing",
      value: formatNumber(dashboard?.orders.pendingOrders ?? 0),
    },
    {
      href: ROUTES.inventoryLowStock,
      label: "Low-stock items",
      note: "Below reorder level",
      value: formatNumber(dashboard?.inventory.lowStockCount ?? 0),
    },
    {
      href: ROUTES.manufacturingBatches,
      label: "Active batches",
      note: "Currently in production",
      value: formatNumber(dashboard?.manufacturing.activeBatches ?? 0),
    },
    {
      href: ROUTES.orders,
      label: "Ready orders",
      note: "Waiting for handover",
      value: formatNumber(dashboard?.orders.readyOrders ?? 0),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[92rem] flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-workspace-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-workspace-muted">Admin workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-brand-espresso">Operations overview</h1>
          <p className="mt-2 text-sm text-workspace-muted">
            {branchScope.effectiveBranchName ?? "All branches"} · {appliedFilters.dateFrom} to{" "}
            {appliedFilters.dateTo}
          </p>
        </div>
        <Button
          className="w-fit"
          disabled={isRefreshing}
          onClick={handleRefresh}
          type="button"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <ReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        compact
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={defaultDraft}
        filters={draftFilters}
        onApply={handleApply}
        onChange={setDraftFilters}
        onReset={handleReset}
      />

      {dashboardQuery.error ? (
        <DashboardErrorState
          description={adminDashboardErrorDescription(dashboardQuery.error)}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : dashboardQuery.isLoading ? (
        <DashboardSkeleton />
      ) : dashboard ? (
        <>
          <DashboardLoadWarningsBanner
            isRetrying={dashboardQuery.isFetching}
            onRetry={() => void dashboardQuery.refetch()}
            warnings={dashboard.loadWarnings}
          />

          <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
            <div className="grid sm:grid-cols-2 xl:grid-cols-5">
              {decisionMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    className="border-b border-workspace-border p-5 sm:border-r xl:border-b-0 last:border-b-0 xl:last:border-r-0"
                    key={metric.label}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-workspace-muted">
                        {metric.label}
                      </p>
                      <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-2xl font-semibold text-brand-espresso">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-workspace-muted">{metric.detail}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-2 border-y border-workspace-border py-3">
            <span className="mr-2 text-xs font-semibold uppercase text-workspace-muted">
              Quick actions
            </span>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-workspace-border bg-white px-3 text-sm font-semibold text-brand-espresso hover:bg-zinc-50"
                  href={action.href}
                  key={action.href}
                >
                  <Icon className="h-4 w-4 text-zinc-500" />
                  {action.label}
                </Link>
              );
            })}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)]">
            <AttentionQueue
              alerts={alertsQuery.data}
              error={alertsQuery.error}
              isLoading={alertsQuery.isLoading}
              onRetry={() => void alertsQuery.refetch()}
            />

            <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
              <SectionHeader
                description="Current workload across daily operations."
                title="Operational health"
              />
              <div>
                {healthRows.map((row) => (
                  <Link
                    className="group flex items-center justify-between gap-4 border-b border-workspace-border px-5 py-3.5 last:border-b-0 hover:bg-zinc-50"
                    href={row.href}
                    key={row.label}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-brand-espresso">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-workspace-muted">{row.note}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <strong className="text-lg text-brand-espresso">{row.value}</strong>
                      <ArrowRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-brand-espresso">Performance workspace</h2>
                <p className="mt-1 text-sm text-workspace-muted">
                  Switch between connected views without leaving the dashboard.
                </p>
              </div>
              <div
                aria-label="Performance view"
                className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-workspace-border bg-white p-1"
                role="group"
              >
                {performanceViews.map((view) => (
                  <button
                    aria-pressed={performanceView === view}
                    className={`h-8 whitespace-nowrap rounded px-3 text-xs font-semibold transition-colors ${
                      performanceView === view
                        ? "bg-zinc-950 text-white"
                        : "text-workspace-muted hover:bg-zinc-100 hover:text-brand-espresso"
                    }`}
                    key={view}
                    onClick={() => setPerformanceView(view)}
                    type="button"
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            {performanceView === "Sales" ? (
              <DashboardChartCard
                description="Sales movement for the active dashboard period."
                error={salesChartQuery.error}
                hasData={hasChartData(salesChartQuery.data)}
                isLoading={salesChartQuery.isLoading}
                onRetry={() => void salesChartQuery.refetch()}
                title="Sales trend"
              >
                {salesChartQuery.data ? <DashboardTrendChart chart={salesChartQuery.data} /> : null}
              </DashboardChartCard>
            ) : null}
            {performanceView === "Orders" ? (
              <DashboardChartCard
                description="Custom and POS-driven order workload for the selected period."
                error={ordersChartQuery.error}
                hasData={hasChartData(ordersChartQuery.data)}
                isLoading={ordersChartQuery.isLoading}
                onRetry={() => void ordersChartQuery.refetch()}
                title="Order workload"
              >
                {ordersChartQuery.data ? (
                  <DashboardTrendChart chart={ordersChartQuery.data} type="bar" />
                ) : null}
              </DashboardChartCard>
            ) : null}
            {performanceView === "Production" ? (
              <DashboardChartCard
                description="Produced quantity and wastage from manufacturing batches."
                error={manufacturingTrendQuery.error}
                hasData={hasChartData(manufacturingTrendQuery.data)}
                isLoading={manufacturingTrendQuery.isLoading}
                onRetry={() => void manufacturingTrendQuery.refetch()}
                title="Production trend"
              >
                {manufacturingTrendQuery.data ? (
                  <DashboardTrendChart chart={manufacturingTrendQuery.data} type="bar" />
                ) : null}
              </DashboardChartCard>
            ) : null}
            {performanceView === "Inventory" ? (
              <DashboardChartCard
                description="Low-stock, expiry, and out-of-stock exposure."
                error={null}
                hasData={inventoryRisk.some((item) => item.value > 0)}
                isLoading={false}
                onRetry={() => undefined}
                title="Inventory risk"
              >
                <DashboardRiskChart items={inventoryRisk} />
              </DashboardChartCard>
            ) : null}
            {performanceView === "Finance" ? (
              <DashboardChartCard
                description="Payment method distribution for the selected period."
                error={paymentsChartQuery.error}
                hasData={hasChartData(paymentsChartQuery.data)}
                isLoading={paymentsChartQuery.isLoading}
                onRetry={() => void paymentsChartQuery.refetch()}
                title="Payment mix"
              >
                {paymentsChartQuery.data ? (
                  <DashboardDonutChart chart={paymentsChartQuery.data} />
                ) : null}
              </DashboardChartCard>
            ) : null}
          </section>

          <ActivityTable
            activities={activityQuery.data}
            error={activityQuery.error}
            isLoading={activityQuery.isLoading}
            onRetry={() => void activityQuery.refetch()}
          />

          <div className="grid gap-3 border-t border-workspace-border pt-4 text-xs text-workspace-muted sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" /> Refreshes every 60 seconds
            </span>
            <span className="flex items-center gap-2">
              <Boxes className="h-4 w-4" /> Branch-aware operational scope
            </span>
            <span className="flex items-center gap-2">
              <UserRound className="h-4 w-4" /> Permission-controlled actions
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
