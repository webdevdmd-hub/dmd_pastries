"use client";

import { ChartPie, Clock, Factory, Truck, WalletCards } from "lucide-react";
import Link from "next/link";
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
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBakeryOrdersSummary, useBakeryOrdersTrend } from "@/hooks/use-bakery-orders-reports";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import type { BakeryOrdersTrendChart as BakeryOrdersTrendChartData } from "@/types/bakery-orders-reports";

const navigationCards = [
  { href: ROUTES.reportsBakeryOrdersUpcoming, icon: Clock, label: "Upcoming Orders" },
  { href: ROUTES.reportsBakeryOrdersStatus, icon: ChartPie, label: "Order Status" },
  {
    href: ROUTES.reportsBakeryOrdersProductionSchedule,
    icon: Factory,
    label: "Production Schedule",
  },
  { href: ROUTES.reportsBakeryOrdersPendingPayments, icon: WalletCards, label: "Pending Payments" },
  { href: ROUTES.reportsBakeryOrdersDeliveryVsPickup, icon: Truck, label: "Delivery vs Pickup" },
] as const;

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
      <ReportPageHeader
        title="Bakery Orders Reports"
        description="Analyze custom order scheduling, production readiness, pending balances, and delivery trends."
      />
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
          <BakeryOrdersReportEmptyState message="No bakery orders trend data found." />
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
    </div>
  );
}
