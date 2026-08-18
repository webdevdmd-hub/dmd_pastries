"use client";

import { CircleDollarSign, Factory, Scale, Soup, Trash2 } from "lucide-react";
import Link from "next/link";
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
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useManufacturingSummary, useManufacturingTrend } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";
import type { ManufacturingTrendChart as ManufacturingTrendChartData } from "@/types/manufacturing-reports";

const navigationCards = [
  { href: ROUTES.reportsManufacturingBatches, icon: Factory, label: "Production Batches" },
  {
    href: ROUTES.reportsManufacturingIngredientConsumption,
    icon: Soup,
    label: "Ingredient Consumption",
  },
  { href: ROUTES.reportsManufacturingYieldVariance, icon: Scale, label: "Yield Variance" },
  { href: ROUTES.reportsManufacturingWastage, icon: Trash2, label: "Manufacturing Wastage" },
  { href: ROUTES.reportsManufacturingRecipeCosts, icon: CircleDollarSign, label: "Recipe Costs" },
] as const;

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
      <ReportPageHeader
        title="Manufacturing Reports"
        description="Analyze production output, recipe costs, ingredient consumption, yield variance, and wastage."
      />
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {navigationCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link href={item.href} key={item.href}>
              <Card className="h-full bg-card/85 shadow-soft transition hover:-translate-y-0.5 hover:shadow-float">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="font-semibold text-brand-espresso">{item.label}</p>
                  </div>
                  <Badge variant="secondary">Open</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
