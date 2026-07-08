"use client";

import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock,
  CreditCard,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/dashboard/access-denied-card";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import { DashboardDonutChart } from "@/components/dashboard/dashboard-donut-chart";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { DashboardInsightRail } from "@/components/dashboard/dashboard-insight-rail";
import { DashboardMetricPanel } from "@/components/dashboard/dashboard-metric-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRiskChart } from "@/components/dashboard/dashboard-risk-chart";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardTrendChart } from "@/components/dashboard/dashboard-trend-chart";
import { ReportFilterBar, type ReportFilterDraft } from "@/components/reports/report-filter-bar";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useAdminDashboard } from "@/hooks/use-dashboard";
import { useManufacturingTrend } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import {
  useOrdersChart,
  usePaymentsChart,
  useReportBranches,
  useSalesChart,
} from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import {
  createDefaultDashboardDraft,
  resolveDashboardTimezone,
  toDashboardReportFilters,
} from "@/lib/reports/dashboard-filters";
import { reportBaseFiltersSchema } from "@/lib/validators/reports.schema";
import type { ManufacturingReportFilters } from "@/types/manufacturing-reports";
import type { ReportFilters } from "@/types/reports";

const actions = [
  { href: ROUTES.pos, icon: ReceiptText, label: "Open POS" },
  { href: ROUTES.orders, icon: ShoppingBag, label: "Create Bakery Order" },
  { href: ROUTES.reports, icon: BarChart3, label: "View Reports" },
  { href: ROUTES.inventoryLowStock, icon: PackageSearch, label: "View Low Stock" },
] as const;

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

export function AdminDashboardClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
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
    () => createDefaultDashboardDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draftFilters, setDraftFilters] = useState<ReportFilterDraft>(defaultDraft);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() =>
    toDashboardReportFilters(defaultDraft, timezone),
  );
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const dashboardQuery = useAdminDashboard(appliedFilters, canView && hasScope);
  const salesChartQuery = useSalesChart(appliedFilters, canView && hasScope);
  const paymentsChartQuery = usePaymentsChart(appliedFilters, canView && hasScope);
  const ordersChartQuery = useOrdersChart(appliedFilters, canView && hasScope);
  const manufacturingTrendFilters = useMemo(
    () => toManufacturingTrendFilters(appliedFilters),
    [appliedFilters],
  );
  const manufacturingTrendQuery = useManufacturingTrend(
    manufacturingTrendFilters,
    canView && hasScope,
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
    setAppliedFilters(toDashboardReportFilters(defaultDraft, timezone));
  };

  const dashboard = dashboardQuery.data;
  const salesMetrics = [
    {
      icon: CircleDollarSign,
      label: "Selected Sales",
      value: formatCurrency(dashboard?.sales.todaySales ?? 0),
    },
    {
      icon: CircleDollarSign,
      label: "Selected Collections",
      value: formatCurrency(dashboard?.financial.collectedToday ?? 0),
    },
    {
      icon: ReceiptText,
      label: "Sales Count",
      value: formatNumber(dashboard?.sales.salesCountToday ?? 0),
    },
    {
      icon: ReceiptText,
      label: "Average Order Value",
      value: formatCurrency(dashboard?.sales.averageOrderValue ?? 0),
    },
  ];
  const inventoryRisk = [
    { label: "Low stock", value: dashboard?.inventory.lowStockCount ?? 0 },
    { label: "Expiring", value: dashboard?.inventory.expiringItems ?? 0 },
    { label: "Out of stock", value: dashboard?.inventory.outOfStock ?? 0 },
  ];
  const productionRisk = [
    { label: "Active batches", value: dashboard?.manufacturing.activeBatches ?? 0 },
    { label: "Completed today", value: dashboard?.manufacturing.completedToday ?? 0 },
    { label: "In production", value: dashboard?.orders.inProduction ?? 0 },
  ];
  const operationMetrics = [
    {
      icon: PackageSearch,
      label: "Low Stock",
      value: formatNumber(dashboard?.inventory.lowStockCount ?? 0),
    },
    {
      icon: PackageSearch,
      label: "Expiring Items",
      value: formatNumber(dashboard?.inventory.expiringItems ?? 0),
    },
    {
      icon: ShoppingBag,
      label: "Pending Orders",
      value: formatNumber(dashboard?.orders.pendingOrders ?? 0),
    },
    {
      icon: Boxes,
      label: "Active Batches",
      value: formatNumber(dashboard?.manufacturing.activeBatches ?? 0),
    },
    {
      icon: Boxes,
      label: "Completed Batches",
      value: formatNumber(dashboard?.manufacturing.completedToday ?? 0),
    },
  ];
  const financeMetrics = [
    {
      icon: CircleDollarSign,
      label: "Collected",
      value: formatCurrency(dashboard?.financial.collectedToday ?? 0),
    },
    {
      icon: CreditCard,
      label: "Refunds",
      value: formatCurrency(dashboard?.financial.refundsToday ?? 0),
    },
    {
      icon: CircleDollarSign,
      label: "Outstanding Balance",
      value: formatCurrency(dashboard?.financial.outstandingBalance ?? 0),
    },
    {
      icon: Clock,
      label: "Ready Orders",
      value: formatNumber(dashboard?.orders.readyOrders ?? 0),
    },
    {
      icon: UserRound,
      label: "New Customers",
      value: formatNumber(dashboard?.customers.newCustomersToday ?? 0),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <DashboardPageHeader
        eyebrow="Admin intelligence"
        title="Admin Dashboard"
        description="Owner-level control surface using the same branch, date, and timezone reporting source as Reports Dashboard."
      />
      <ReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={defaultDraft}
        filters={draftFilters}
        onApply={handleApply}
        onChange={setDraftFilters}
        onReset={handleReset}
      />
      {dashboardQuery.error ? (
        <DashboardErrorState
          description={getErrorMessage(dashboardQuery.error)}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}
      {dashboardQuery.isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.8fr)]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] border border-brand-cappuccino/70 bg-[radial-gradient(circle_at_top_left,_rgba(176,137,104,0.28),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(243,233,215,0.92))] p-6 shadow-soft">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-mocha">
                    Live operating cockpit
                  </p>
                  <h2 className="mt-3 text-3xl font-bold text-brand-espresso">
                    {branchScope.effectiveBranchName ?? "Current branch"} performance snapshot
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-mocha">
                    Monitor sales, cash flow, order pressure, stock risk, production, and customer
                    activity from one branch-aware control surface.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {salesMetrics.slice(0, 4).map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div
                        className="rounded-3xl border border-brand-cappuccino/60 bg-white/70 p-4"
                        key={metric.label}
                      >
                        <Icon className="h-5 w-5 text-brand-mocha" aria-hidden="true" />
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-mocha">
                          {metric.label}
                        </p>
                        <p className="mt-2 text-2xl font-black text-brand-espresso">
                          {metric.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardChartCard
                description="Current month revenue trend from the reports chart API."
                error={salesChartQuery.error}
                hasData={hasChartData(salesChartQuery.data)}
                isLoading={salesChartQuery.isLoading}
                onRetry={() => void salesChartQuery.refetch()}
                title="Revenue Trend"
              >
                {salesChartQuery.data ? <DashboardTrendChart chart={salesChartQuery.data} /> : null}
              </DashboardChartCard>
              <DashboardChartCard
                description="Payment method distribution for the selected dashboard period."
                error={paymentsChartQuery.error}
                hasData={hasChartData(paymentsChartQuery.data)}
                isLoading={paymentsChartQuery.isLoading}
                onRetry={() => void paymentsChartQuery.refetch()}
                title="Payment Mix"
              >
                {paymentsChartQuery.data ? (
                  <DashboardDonutChart chart={paymentsChartQuery.data} />
                ) : null}
              </DashboardChartCard>
            </div>

            <DashboardChartCard
              description="Order workload trend for custom and POS-driven order volume."
              error={ordersChartQuery.error}
              hasData={hasChartData(ordersChartQuery.data)}
              isLoading={ordersChartQuery.isLoading}
              onRetry={() => void ordersChartQuery.refetch()}
              title="Order Workload"
            >
              {ordersChartQuery.data ? (
                <DashboardTrendChart chart={ordersChartQuery.data} type="bar" />
              ) : null}
            </DashboardChartCard>

            <DashboardChartCard
              description="Produced quantity and wastage trend from manufacturing batches."
              error={manufacturingTrendQuery.error}
              hasData={hasChartData(manufacturingTrendQuery.data)}
              isLoading={manufacturingTrendQuery.isLoading}
              onRetry={() => void manufacturingTrendQuery.refetch()}
              title="Production Trend"
            >
              {manufacturingTrendQuery.data ? (
                <DashboardTrendChart chart={manufacturingTrendQuery.data} type="bar" />
              ) : null}
            </DashboardChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardMetricPanel
                description="Stock and production indicators that need operational attention."
                metrics={operationMetrics}
                title="Operational Pressure"
              />
              <DashboardMetricPanel
                description="Cash collection, refunds, outstanding balance, and ready orders."
                metrics={financeMetrics}
                title="Financial Snapshot"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardChartCard
                description="Low stock, expiry, and out-of-stock exposure."
                error={null}
                hasData={inventoryRisk.some((item) => item.value > 0)}
                isLoading={false}
                onRetry={() => undefined}
                title="Inventory Risk"
              >
                <DashboardRiskChart items={inventoryRisk} />
              </DashboardChartCard>
              <DashboardChartCard
                description="Production batches and bakery order production load."
                error={null}
                hasData={productionRisk.some((item) => item.value > 0)}
                isLoading={false}
                onRetry={() => undefined}
                title="Production Overview"
              >
                <DashboardRiskChart items={productionRisk} />
              </DashboardChartCard>
            </div>
          </div>
          <DashboardInsightRail actions={[...actions]} canLoad={true} />
        </div>
      )}
    </div>
  );
}
