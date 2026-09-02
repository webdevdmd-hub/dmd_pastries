"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/manufacturing/access-denied-card";
import { ManufacturingReportEmptyState } from "@/components/reports/manufacturing/manufacturing-report-empty-state";
import {
  ManufacturingReportFilterBar,
  type ManufacturingReportFilterDraft,
  toManufacturingReportFilters,
} from "@/components/reports/manufacturing/manufacturing-report-filter-bar";
import {
  defaultManufacturingReportDraft,
  parseManufacturingReportDraft,
} from "@/components/reports/manufacturing/manufacturing-report-page-utils";
import { ManufacturingSummaryCards } from "@/components/reports/manufacturing/manufacturing-summary-cards";
import { ManufacturingTrendChart } from "@/components/reports/manufacturing/manufacturing-trend-chart";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useManufacturingSummary, useManufacturingTrend } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";
import type { ManufacturingTrendChart as ManufacturingTrendChartData } from "@/types/manufacturing-reports";

function isTrendEmpty(chart: ManufacturingTrendChartData | undefined): boolean {
  return (
    !chart ||
    chart.datasets.length === 0 ||
    chart.datasets.every((dataset) => dataset.data.length === 0)
  );
}

export function ManufacturingReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) &&
    hasAnyPermission([PERMISSIONS.manufacturingView]);
  const initialDraft = useMemo(
    () => defaultManufacturingReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<ManufacturingReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toManufacturingReportFilters(initialDraft));
  // Zero rows means two different things on a report: nothing happened in
  // the default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = toManufacturingReportFilters(initialDraft);
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useManufacturingSummary(filters, canView && hasScope);
  const trendQuery = useManufacturingTrend(filters, canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const applyFilters = (): void => {
    const next = parseManufacturingReportDraft(draft);
    if (next) setFilters(next);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ManufacturingReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toManufacturingReportFilters(initialDraft))}
      />
      <ManufacturingSummaryCards summary={summaryQuery.data} />
      <ReportChartCard
        caption="Produced quantity versus wastage quantity for the selected period."
        error={trendQuery.error}
        isEmpty={isTrendEmpty(trendQuery.data)}
        isLoading={trendQuery.isLoading}
        title="Manufacturing Trend"
        onRetry={() => void trendQuery.refetch()}
      >
        {trendQuery.data ? (
          <ManufacturingTrendChart chart={trendQuery.data} />
        ) : (
          <ManufacturingReportEmptyState
            isFiltered={isReportNarrowed}
            message="No manufacturing trend data in this period."
            noun="manufacturing trend data"
            onClearFilters={() => setFilters(reportDefaultFilters)}
          />
        )}
      </ReportChartCard>
    </div>
  );
}
