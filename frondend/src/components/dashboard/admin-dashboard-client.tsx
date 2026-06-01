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
import { useMemo } from "react";

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
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useAdminDashboard } from "@/hooks/use-dashboard";
import { usePermission } from "@/hooks/use-permission";
import { useOrdersChart, usePaymentsChart, useSalesChart } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import type { ReportFilters } from "@/types/reports";

const actions = [
  { href: ROUTES.pos, icon: ReceiptText, label: "Open POS" },
  { href: ROUTES.orders, icon: ShoppingBag, label: "Create Bakery Order" },
  { href: ROUTES.reports, icon: BarChart3, label: "View Reports" },
  { href: ROUTES.inventoryLowStock, icon: PackageSearch, label: "View Low Stock" },
] as const;

function monthFilters(): ReportFilters {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toDateInputValue = (value: Date): string => {
    const year = String(value.getFullYear());
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  return {
    dateFrom: toDateInputValue(firstDay),
    dateTo: toDateInputValue(lastDay),
    groupBy: "day",
    timezone: "Asia/Dubai",
  };
}

function hasChartData(
  data: { datasets: { data: number[] }[]; labels: string[] } | undefined,
): boolean {
  return Boolean(
    data && data.labels.length > 0 && data.datasets.some((dataset) => dataset.data.length > 0),
  );
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
  const dashboardQuery = useAdminDashboard(canView && hasScope);
  const reportFilters = useMemo(monthFilters, []);
  const salesChartQuery = useSalesChart(reportFilters, canView && hasScope);
  const paymentsChartQuery = usePaymentsChart(reportFilters, canView && hasScope);
  const ordersChartQuery = useOrdersChart(reportFilters, canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const dashboard = dashboardQuery.data;
  const salesMetrics = [
    {
      icon: CircleDollarSign,
      label: "Today Sales",
      value: formatCurrency(dashboard?.sales.todaySales ?? 0),
    },
    {
      icon: CircleDollarSign,
      label: "Monthly Sales",
      value: formatCurrency(dashboard?.sales.monthlySales ?? 0),
    },
    {
      icon: ReceiptText,
      label: "Sales Count Today",
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
      label: "Completed Today",
      value: formatNumber(dashboard?.manufacturing.completedToday ?? 0),
    },
  ];
  const financeMetrics = [
    {
      icon: CircleDollarSign,
      label: "Collected Today",
      value: formatCurrency(dashboard?.financial.collectedToday ?? 0),
    },
    {
      icon: CreditCard,
      label: "Refunds Today",
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
      label: "New Customers Today",
      value: formatNumber(dashboard?.customers.newCustomersToday ?? 0),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <DashboardPageHeader
        eyebrow="Admin intelligence"
        title="Admin Dashboard"
        description="Owner-level control surface for sales, inventory, bakery orders, production, finance, alerts, and activity."
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
