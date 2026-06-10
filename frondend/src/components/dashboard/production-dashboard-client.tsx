"use client";

import { Boxes, Clock, ListChecks, PackageSearch, Soup, Wheat } from "lucide-react";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/dashboard/access-denied-card";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { DashboardInsightRail } from "@/components/dashboard/dashboard-insight-rail";
import { DashboardMetricPanel } from "@/components/dashboard/dashboard-metric-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRiskChart } from "@/components/dashboard/dashboard-risk-chart";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { formatNumber } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useProductionDashboard } from "@/hooks/use-dashboard";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

const actions = [
  { href: ROUTES.manufacturingBatches, icon: Boxes, label: "Create Production" },
  { href: ROUTES.manufacturingBatches, icon: Soup, label: "View Manufacturing" },
  { href: ROUTES.recipes, icon: ListChecks, label: "View Recipe List" },
  { href: ROUTES.reportsBakeryOrdersProductionSchedule, icon: Clock, label: "View Schedule" },
] as const;

export function ProductionDashboardClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([
    PERMISSIONS.dashboardView,
    PERMISSIONS.manufacturingView,
    PERMISSIONS.recipesView,
  ]);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const dashboardQuery = useProductionDashboard(canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const dashboard = dashboardQuery.data;
  const batchMetrics = [
    {
      icon: Boxes,
      label: "Active Batches",
      value: formatNumber(dashboard?.batches.activeBatches ?? 0),
    },
    {
      icon: Boxes,
      label: "Completed Today",
      value: formatNumber(dashboard?.batches.completedToday ?? 0),
    },
    {
      icon: Boxes,
      label: "Pending Batches",
      value: formatNumber(dashboard?.batches.pendingBatches ?? 0),
    },
  ];
  const ingredientMetrics = [
    {
      icon: Wheat,
      label: "Low Stock Ingredients",
      value: formatNumber(dashboard?.ingredients.lowStockIngredients ?? 0),
    },
    {
      icon: PackageSearch,
      label: "Expiring Ingredients",
      value: formatNumber(dashboard?.ingredients.expiringIngredients ?? 0),
    },
  ];
  const productionLoad = [
    {
      label: "Waiting production",
      value: dashboard?.orders.ordersWaitingProduction ?? 0,
    },
    {
      label: "Due today",
      value: dashboard?.orders.ordersDueToday ?? 0,
    },
    {
      label: "Wastage today",
      value: dashboard?.wastage.wastageToday ?? 0,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <DashboardPageHeader
        eyebrow="Production intelligence"
        title="Production Dashboard"
        description="Production priorities for batches, ingredient risks, scheduled orders, and wastage."
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.85fr)]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardMetricPanel
                description="Batch progress and today completion pressure."
                metrics={batchMetrics}
                title="Batch Performance"
              />
              <DashboardMetricPanel
                description="Ingredient availability issues before production starts."
                metrics={ingredientMetrics}
                title="Ingredient Risk"
              />
            </div>
            <DashboardChartCard
              description="Production queue, urgent orders, and wastage pressure."
              error={null}
              hasData={true}
              isLoading={false}
              onRetry={() => undefined}
              title="Production Load"
            >
              <DashboardRiskChart items={productionLoad} />
            </DashboardChartCard>
          </div>
          <DashboardInsightRail actions={[...actions]} canLoad={true} />
        </div>
      )}
    </div>
  );
}
