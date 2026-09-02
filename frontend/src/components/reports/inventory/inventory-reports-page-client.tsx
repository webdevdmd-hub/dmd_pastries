"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/inventory/access-denied-card";
import {
  InventoryReportFilterBar,
  type InventoryReportFilterDraft,
  toInventoryReportFilters,
} from "@/components/reports/inventory/inventory-report-filter-bar";
import {
  defaultInventoryReportDraft,
  parseInventoryReportDraft,
} from "@/components/reports/inventory/inventory-report-page-utils";
import { InventorySummaryCards } from "@/components/reports/inventory/inventory-summary-cards";
import { InventoryTrendChart } from "@/components/reports/inventory/inventory-trend-chart";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useInventorySummary, useInventoryTrend } from "@/hooks/use-inventory-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";

function isTrendEmpty(chart: ReturnType<typeof useInventoryTrend>["data"]): boolean {
  return (
    !chart ||
    chart.datasets.length === 0 ||
    chart.datasets.every((dataset) => dataset.data.length === 0)
  );
}

export function InventoryReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) && hasAnyPermission([PERMISSIONS.inventoryView]);
  const initialDraft = useMemo(
    () => defaultInventoryReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<InventoryReportFilterDraft>(initialDraft);
  const timezone = useMemo(resolveDashboardTimezone, []);
  const [filters, setFilters] = useState(() => ({
    ...toInventoryReportFilters(initialDraft),
    timezone,
  }));
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useInventorySummary(filters, canView && hasScope);
  const trendQuery = useInventoryTrend(filters, canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const applyFilters = (): void => {
    const next = parseInventoryReportDraft(draft);
    if (next) setFilters({ ...next, timezone });
  };

  const resetFilters = (): void =>
    setFilters({ ...toInventoryReportFilters(initialDraft), timezone });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <InventoryReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={resetFilters}
      />
      <InventorySummaryCards summary={summaryQuery.data} />
      <ReportChartCard
        caption="Stock in versus stock out movement trend."
        error={trendQuery.error}
        isEmpty={isTrendEmpty(trendQuery.data)}
        isLoading={trendQuery.isLoading}
        title="Inventory Trend"
        onRetry={() => void trendQuery.refetch()}
      >
        {trendQuery.data ? <InventoryTrendChart chart={trendQuery.data} /> : null}
      </ReportChartCard>
    </div>
  );
}
