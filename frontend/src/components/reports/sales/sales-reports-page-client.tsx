"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReportChartCard } from "@/components/reports/report-chart-card";
import { AccessDeniedCard } from "@/components/reports/sales/access-denied-card";
import { DailySalesTable } from "@/components/reports/sales/daily-sales-table";
import { SalesReportEmptyState } from "@/components/reports/sales/sales-report-empty-state";
import { SalesReportErrorState } from "@/components/reports/sales/sales-report-error-state";
import {
  SalesReportFilterBar,
  type SalesReportFilterDraft,
  toSalesReportFilters,
} from "@/components/reports/sales/sales-report-filter-bar";
import { SalesReportSkeleton } from "@/components/reports/sales/sales-report-skeleton";
import { SalesSummaryCards } from "@/components/reports/sales/sales-summary-cards";
import { SalesTrendChart } from "@/components/reports/sales/sales-trend-chart";
import { SlowMovingProductsCard } from "@/components/reports/sales/slow-moving-products-card";
import { TopProductsCard } from "@/components/reports/sales/top-products-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import {
  useDailySales,
  useSalesSummary,
  useSalesTrend,
  useSlowMovingProducts,
  useTopProducts,
} from "@/hooks/use-sales-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";
import { salesReportFiltersSchema } from "@/lib/validators/sales-reports.schema";
import type {
  SalesReportFilters,
  SalesTrendChart as SalesTrendChartData,
} from "@/types/sales-reports";

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
  } catch {
    return "Asia/Dubai";
  }
}

function defaultDraft(branchId: string): SalesReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    datePreset: "this_month",
    groupBy: "day",
  };
}

function isTrendEmpty(chart: SalesTrendChartData | undefined): boolean {
  return (
    !chart ||
    chart.datasets.length === 0 ||
    chart.datasets.every((dataset) => dataset.data.length === 0)
  );
}

export function SalesReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const currentTimezone = useMemo(timezone, []);
  const initialDraft = useMemo(
    () => defaultDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<SalesReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState<SalesReportFilters>(() =>
    toSalesReportFilters(initialDraft, currentTimezone),
  );
  // Zero rows means two different things on a report: nothing happened in the
  // default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = toSalesReportFilters(initialDraft, currentTimezone);
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useSalesSummary(filters, canView && hasScope);
  const trendQuery = useSalesTrend(filters, canView && hasScope);
  const dailyQuery = useDailySales(filters, canView && hasScope);
  const topProductsQuery = useTopProducts(filters, canView && hasScope);
  const slowProductsQuery = useSlowMovingProducts(filters, canView && hasScope);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!hasScope) {
    return <NoBranchScopeCard />;
  }

  const applyFilters = (): void => {
    const nextFilters = toSalesReportFilters(draft, currentTimezone);
    const parsed = salesReportFiltersSchema.safeParse(nextFilters);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Sales report filters are invalid.");
      return;
    }
    setFilters(nextFilters);
  };

  const resetFilters = (): void => {
    setFilters(toSalesReportFilters(initialDraft, currentTimezone));
  };

  const firstError =
    summaryQuery.error ??
    trendQuery.error ??
    dailyQuery.error ??
    topProductsQuery.error ??
    slowProductsQuery.error;
  const isReportLoading =
    summaryQuery.isLoading ||
    trendQuery.isLoading ||
    dailyQuery.isLoading ||
    topProductsQuery.isLoading ||
    slowProductsQuery.isLoading;
  const reportData =
    !isReportLoading &&
    !firstError &&
    summaryQuery.data &&
    trendQuery.data &&
    dailyQuery.data &&
    topProductsQuery.data &&
    slowProductsQuery.data
      ? {
          daily: dailyQuery.data,
          slowProducts: slowProductsQuery.data,
          summary: summaryQuery.data,
          topProducts: topProductsQuery.data,
          trend: trendQuery.data,
        }
      : null;
  const retryReports = (): void => {
    void Promise.all([
      summaryQuery.refetch(),
      trendQuery.refetch(),
      dailyQuery.refetch(),
      topProductsQuery.refetch(),
      slowProductsQuery.refetch(),
    ]);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <SalesReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={resetFilters}
      />
      {isReportLoading && !firstError ? (
        <div className="grid gap-4">
          <SalesReportSkeleton />
          <SalesReportSkeleton />
        </div>
      ) : null}
      {firstError ? (
        <SalesReportErrorState description={getErrorMessage(firstError)} onRetry={retryReports} />
      ) : null}
      {reportData ? (
        <>
          <SalesSummaryCards summary={reportData.summary} />
          <ReportChartCard
            caption="Net sales and sales count trend for the selected period."
            error={null}
            isEmpty={isTrendEmpty(reportData.trend)}
            isLoading={false}
            title="Sales Trend"
            onRetry={retryReports}
          >
            <SalesTrendChart chart={reportData.trend} />
          </ReportChartCard>
          <div className="grid gap-4 xl:grid-cols-2">
            <TopProductsCard products={reportData.topProducts} />
            <SlowMovingProductsCard products={reportData.slowProducts} />
          </div>
          <Card className="bg-card/85 shadow-soft">
            <CardHeader>
              <CardTitle className="text-brand-espresso">Daily Sales</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.daily.length > 0 ? (
                <DailySalesTable rows={reportData.daily} />
              ) : (
                <SalesReportEmptyState
                  isFiltered={isReportNarrowed}
                  message="No daily sales in this period."
                  noun="daily sales"
                  onClearFilters={resetFilters}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
