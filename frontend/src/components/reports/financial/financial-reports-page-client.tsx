"use client";

import { Landmark } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/financial/access-denied-card";
import { FinancialReportEmptyState } from "@/components/reports/financial/financial-report-empty-state";
import {
  FinancialReportFilterBar,
  type FinancialReportFilterDraft,
  toFinancialReportFilters,
} from "@/components/reports/financial/financial-report-filter-bar";
import {
  defaultFinancialReportDraft,
  parseFinancialReportDraft,
} from "@/components/reports/financial/financial-report-page-utils";
import { FinancialSummaryCards } from "@/components/reports/financial/financial-summary-cards";
import { FinancialTrendChart } from "@/components/reports/financial/financial-trend-chart";
import { ReportLedgerNotice } from "@/components/reports/financial/report-ledger-notice";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useFinancialSummary, useFinancialTrend } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";
import type { FinancialTrendChart as FinancialTrendChartData } from "@/types/financial-reports";

function isTrendEmpty(chart: FinancialTrendChartData | undefined): boolean {
  return (
    !chart ||
    chart.datasets.length === 0 ||
    chart.datasets.every((dataset) => dataset.data.length === 0)
  );
}

export function FinancialReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const initialDraft = useMemo(
    () => defaultFinancialReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<FinancialReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toFinancialReportFilters(initialDraft));
  // Zero rows means two different things on a report: nothing happened in
  // the default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = toFinancialReportFilters(initialDraft);
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const summaryQuery = useFinancialSummary(filters, canView && hasScope);
  const trendQuery = useFinancialTrend(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseFinancialReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <FinancialReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        sourceTypeOptions={[
          { label: "All sources", value: "all" },
          { label: "POS sale", value: "pos_sale" },
          { label: "Bakery order", value: "bakery_order" },
          { label: "Sales return", value: "sales_return" },
          { label: "Purchase invoice", value: "purchase_invoice" },
        ]}
        statusOptions={[]}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toFinancialReportFilters(initialDraft))}
      />
      <FinancialSummaryCards
        errorMessage={summaryQuery.error ? getErrorMessage(summaryQuery.error) : undefined}
        onRetry={() => {
          void summaryQuery.refetch();
        }}
        summary={summaryQuery.data}
      />
      <ReportChartCard
        caption="Collected, refunded, and net collected movement for the selected period."
        error={trendQuery.error}
        isEmpty={isTrendEmpty(trendQuery.data)}
        isLoading={trendQuery.isLoading}
        title="Financial Trend"
        onRetry={() => void trendQuery.refetch()}
      >
        {trendQuery.data ? (
          <div className="flex flex-col gap-4">
            <FinancialTrendChart chart={trendQuery.data} />
            <ReportLedgerNotice
              note="Each point is read from the accounting ledger and cross-checked against the operational records."
              sourceOfTruth={trendQuery.data.sourceOfTruth}
              warnings={trendQuery.data.consistencyWarnings}
            />
          </div>
        ) : (
          <FinancialReportEmptyState
            isFiltered={isReportNarrowed}
            message="No financial trend data in this period."
            noun="financial trend data"
            onClearFilters={() => setFilters(reportDefaultFilters)}
          />
        )}
      </ReportChartCard>
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="flex items-center gap-3 p-5 text-brand-mocha">
          <Landmark className="h-5 w-5 text-brand-mocha" aria-hidden="true" />
          <p className="text-sm">
            Backend remains authoritative for totals, payments, refunds, supplier balances, and
            reconciliation transactions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
