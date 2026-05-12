"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/reports/access-denied-card";
import { OrdersChart } from "@/components/reports/orders-chart";
import { PaymentsChart } from "@/components/reports/payments-chart";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { ReportFilterBar, type ReportFilterDraft } from "@/components/reports/report-filter-bar";
import { ReportKpiGrid } from "@/components/reports/report-kpi-grid";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { SalesChart } from "@/components/reports/sales-chart";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import {
  useOrdersReportChart,
  usePaymentsReportChart,
  useReportBranches,
  useReportsDashboardSummary,
  useSalesReportChart,
} from "@/hooks/use-reports";
import { reportBaseFiltersSchema } from "@/lib/validators/reports.schema";
import type { ReportChartData, ReportFilters } from "@/types/reports";

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
  } catch {
    return "Asia/Dubai";
  }
}

function createDefaultDraft(branchId: string): ReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    datePreset: "this_month",
    groupBy: "day",
  };
}

function toReportFilters(draft: ReportFilterDraft, timezone: string): ReportFilters {
  return {
    ...(draft.branchId === "all"
      ? { branchId: "all", scope: "all_branches" as const }
      : draft.branchId
        ? { branchId: draft.branchId, scope: "current_branch" as const }
        : { scope: "current_branch" as const }),
    dateFrom: draft.dateFrom,
    dateTo: draft.dateTo,
    groupBy: draft.groupBy,
    timezone,
  };
}

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
  const timezone = useMemo(resolveTimezone, []);
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const hasReportBranchScope =
    branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const defaultDraft = useMemo(
    () => createDefaultDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draftFilters, setDraftFilters] = useState<ReportFilterDraft>(defaultDraft);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() =>
    toReportFilters(defaultDraft, timezone),
  );
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useReportsDashboardSummary(appliedFilters, canView && hasReportBranchScope);
  const salesChartQuery = useSalesReportChart(appliedFilters, canView && hasReportBranchScope);
  const paymentsChartQuery = usePaymentsReportChart(
    appliedFilters,
    canView && hasReportBranchScope,
  );
  const ordersChartQuery = useOrdersReportChart(appliedFilters, canView && hasReportBranchScope);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!hasReportBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleApply = (): void => {
    const parsed = reportBaseFiltersSchema.safeParse(toReportFilters(draftFilters, timezone));

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Report filters are invalid.");
      return;
    }

    setAppliedFilters(toReportFilters(draftFilters, timezone));
  };

  const handleReset = (): void => {
    setAppliedFilters(toReportFilters(defaultDraft, timezone));
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
      <ReportKpiGrid summary={summaryQuery.data} />
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
