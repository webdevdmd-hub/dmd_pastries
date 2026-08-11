"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/reports/access-denied-card";
import { OrdersChart } from "@/components/reports/orders-chart";
import { PaymentsChart } from "@/components/reports/payments-chart";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { ReportErrorState } from "@/components/reports/report-error-state";
import { ReportFilterBar, type ReportFilterDraft } from "@/components/reports/report-filter-bar";
import { ReportKpiGrid } from "@/components/reports/report-kpi-grid";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { SalesChart } from "@/components/reports/sales-chart";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import {
  useOrdersReportChart,
  usePaymentsReportChart,
  useReportBranches,
  useReportsDashboardSummary,
  useSalesReportChart,
} from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import {
  createDefaultDashboardDraft,
  resolveDashboardTimezone,
  toDashboardReportFilters,
} from "@/lib/reports/dashboard-filters";
import { reportBaseFiltersSchema } from "@/lib/validators/reports.schema";
import type { ReportChartData, ReportFilters } from "@/types/reports";

function isChartEmpty(chart: ReportChartData | undefined): boolean {
  return (
    !chart ||
    chart.datasets.length === 0 ||
    chart.datasets.every((dataset) => dataset.data.length === 0)
  );
}

export function ReportsDashboardClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const timezone = useMemo(resolveDashboardTimezone, []);
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const hasReportBranchScope =
    branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
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
  const canLoadReportsDashboard = canView && hasReportBranchScope;
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useReportsDashboardSummary(appliedFilters, canLoadReportsDashboard);
  const salesChartQuery = useSalesReportChart(appliedFilters, canLoadReportsDashboard);
  const paymentsChartQuery = usePaymentsReportChart(appliedFilters, canLoadReportsDashboard);
  const ordersChartQuery = useOrdersReportChart(appliedFilters, canLoadReportsDashboard);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!hasReportBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleApply = (): void => {
    const parsed = reportBaseFiltersSchema.safeParse(
      toDashboardReportFilters(draftFilters, timezone),
    );

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Report filters are invalid.");
      return;
    }

    setAppliedFilters(toDashboardReportFilters(draftFilters, timezone));
  };

  const handleReset = (): void => {
    setDraftFilters(defaultDraft);
    setAppliedFilters(toDashboardReportFilters(defaultDraft, timezone));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Reports Dashboard"
        description="High-level business performance overview from backend-owned reporting APIs."
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
      {summaryQuery.error ? (
        <ReportErrorState
          description={getErrorMessage(summaryQuery.error)}
          onRetry={() => {
            void summaryQuery.refetch();
          }}
        />
      ) : null}
      {!summaryQuery.error ? (
        <ReportKpiGrid isLoading={summaryQuery.isLoading} summary={summaryQuery.data} />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <ReportChartCard
          caption="Sales performance by selected period."
          error={salesChartQuery.error}
          isEmpty={isChartEmpty(salesChartQuery.data)}
          isLoading={salesChartQuery.isLoading}
          title="Sales Chart"
          onRetry={() => {
            void salesChartQuery.refetch();
          }}
        >
          {salesChartQuery.data ? <SalesChart chart={salesChartQuery.data} /> : null}
        </ReportChartCard>
        <ReportChartCard
          caption="Payment collection trend by selected period."
          error={paymentsChartQuery.error}
          isEmpty={isChartEmpty(paymentsChartQuery.data)}
          isLoading={paymentsChartQuery.isLoading}
          title="Payments Chart"
          onRetry={() => {
            void paymentsChartQuery.refetch();
          }}
        >
          {paymentsChartQuery.data ? <PaymentsChart chart={paymentsChartQuery.data} /> : null}
        </ReportChartCard>
        <ReportChartCard
          caption="Bakery order volume by selected period."
          error={ordersChartQuery.error}
          isEmpty={isChartEmpty(ordersChartQuery.data)}
          isLoading={ordersChartQuery.isLoading}
          title="Orders Chart"
          onRetry={() => {
            void ordersChartQuery.refetch();
          }}
        >
          {ordersChartQuery.data ? <OrdersChart chart={ordersChartQuery.data} /> : null}
        </ReportChartCard>
      </div>
    </div>
  );
}
