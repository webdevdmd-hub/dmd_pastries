"use client";

import {
  ClipboardCheck,
  ClockAlert,
  PackageSearch,
  PackageX,
  Scale,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import Link from "next/link";
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
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useInventorySummary, useInventoryTrend } from "@/hooks/use-inventory-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";

const navigationCards = [
  { href: ROUTES.reportsInventoryCurrentStock, icon: PackageSearch, label: "Current Stock" },
  { href: ROUTES.reportsInventoryValuation, icon: ClipboardCheck, label: "Stock Valuation" },
  { href: ROUTES.reportsInventoryLowStock, icon: PackageX, label: "Low Stock" },
  { href: ROUTES.reportsInventoryExpiry, icon: ClockAlert, label: "Expiry Report" },
  { href: ROUTES.reportsInventoryMovements, icon: ClipboardCheck, label: "Stock Movements" },
  { href: ROUTES.reportsInventoryWastage, icon: Trash2, label: "Wastage" },
  { href: ROUTES.reportsInventoryPackaging, icon: PackageSearch, label: "Packaging Stock" },
  { href: ROUTES.reportsInventoryAudit, icon: ShieldAlert, label: "Inventory Audit" },
  {
    href: ROUTES.reportsInventoryAccountingReconciliation,
    icon: Scale,
    label: "Inventory Accounting",
  },
] as const;

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
      <ReportPageHeader
        title="Inventory Reports"
        description="Analyze stock levels, valuation, expiry risks, movements, wastage, packaging, and audit accuracy."
      />
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
