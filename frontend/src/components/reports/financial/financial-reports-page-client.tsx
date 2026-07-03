"use client";

import { Landmark, ReceiptText, RotateCcw, Scale, Truck, WalletCards } from "lucide-react";
import Link from "next/link";
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
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useFinancialSummary, useFinancialTrend } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import type { FinancialTrendChart as FinancialTrendChartData } from "@/types/financial-reports";

const navigationCards = [
  { href: ROUTES.reportsFinancialPayments, icon: WalletCards, label: "Payments" },
  { href: ROUTES.reportsFinancialRefunds, icon: RotateCcw, label: "Refunds" },
  {
    href: ROUTES.reportsFinancialOutstandingBalances,
    icon: ReceiptText,
    label: "Outstanding Balances",
  },
  { href: ROUTES.reportsFinancialSupplierPayables, icon: Truck, label: "Supplier Payables" },
  { href: ROUTES.reportsFinancialReconciliation, icon: Scale, label: "Reconciliation" },
] as const;

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
      <ReportPageHeader
        title="Financial Reports"
        description="Analyze collections, refunds, balances, supplier payables, and financial performance."
      />
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
      <FinancialSummaryCards summary={summaryQuery.data} />
      <ReportChartCard
        caption="Collected, refunded, and net collected movement for the selected period."
        error={trendQuery.error}
        isEmpty={isTrendEmpty(trendQuery.data)}
        isLoading={trendQuery.isLoading}
        title="Financial Trend"
        onRetry={() => void trendQuery.refetch()}
      >
        {trendQuery.data ? (
          <FinancialTrendChart chart={trendQuery.data} />
        ) : (
          <FinancialReportEmptyState message="No financial trend data found." />
        )}
      </ReportChartCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {navigationCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link href={item.href} key={item.href}>
              <Card className="h-full bg-white/85 shadow-soft transition hover:-translate-y-0.5 hover:shadow-float">
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
      <Card className="bg-white/85 shadow-soft">
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
