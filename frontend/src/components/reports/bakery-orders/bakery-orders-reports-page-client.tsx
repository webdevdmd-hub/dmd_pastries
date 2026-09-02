"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/bakery-orders/access-denied-card";
import { BakeryOrdersReportEmptyState } from "@/components/reports/bakery-orders/bakery-orders-report-empty-state";
import {
  BakeryOrdersReportFilterBar,
  type BakeryOrdersReportFilterDraft,
  toBakeryOrdersReportFilters,
} from "@/components/reports/bakery-orders/bakery-orders-report-filter-bar";
import {
  defaultBakeryOrdersReportDraft,
  parseBakeryOrdersReportDraft,
} from "@/components/reports/bakery-orders/bakery-orders-report-page-utils";
import { BakeryOrdersSummaryCards } from "@/components/reports/bakery-orders/bakery-orders-summary-cards";
import { BakeryOrdersTrendChart } from "@/components/reports/bakery-orders/bakery-orders-trend-chart";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBakeryOrdersSummary, useBakeryOrdersTrend } from "@/hooks/use-bakery-orders-reports";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";
import type { BakeryOrdersTrendChart as BakeryOrdersTrendChartData } from "@/types/bakery-orders-reports";

function isTrendEmpty(chart: BakeryOrdersTrendChartData | undefined): boolean {
  return (
    !chart ||
    chart.datasets.length === 0 ||
    chart.datasets.every((dataset) => dataset.data.length === 0)
  );
}

export function BakeryOrdersReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) && hasAnyPermission([PERMISSIONS.ordersView]);
  const initialDraft = useMemo(
    () => defaultBakeryOrdersReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<BakeryOrdersReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toBakeryOrdersReportFilters(initialDraft));
  // Zero rows means two different things on a report: nothing happened in
  // the default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = toBakeryOrdersReportFilters(initialDraft);
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useBakeryOrdersSummary(filters, canView && hasScope);
  const trendQuery = useBakeryOrdersTrend(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseBakeryOrdersReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <BakeryOrdersReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toBakeryOrdersReportFilters(initialDraft))}
      />
      <BakeryOrdersSummaryCards summary={summaryQuery.data} />
      <ReportChartCard
        caption="Orders versus revenue for the selected period."
        error={trendQuery.error}
        isEmpty={isTrendEmpty(trendQuery.data)}
        isLoading={trendQuery.isLoading}
        title="Bakery Orders Trend"
        onRetry={() => void trendQuery.refetch()}
      >
        {trendQuery.data ? (
          <BakeryOrdersTrendChart chart={trendQuery.data} />
        ) : (
          <BakeryOrdersReportEmptyState
            isFiltered={isReportNarrowed}
            message="No bakery orders trend data in this period."
            noun="bakery orders trend data"
            onClearFilters={() => setFilters(reportDefaultFilters)}
          />
        )}
      </ReportChartCard>
    </div>
  );
}
