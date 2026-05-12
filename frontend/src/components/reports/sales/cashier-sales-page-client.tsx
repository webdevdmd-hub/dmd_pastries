"use client";

import { ReceiptText, UserRound } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { AccessDeniedCard } from "@/components/reports/sales/access-denied-card";
import { CashierSalesTable } from "@/components/reports/sales/cashier-sales-table";
import { SalesReportEmptyState } from "@/components/reports/sales/sales-report-empty-state";
import { SalesReportErrorState } from "@/components/reports/sales/sales-report-error-state";
import {
  SalesReportFilterBar,
  type SalesReportFilterDraft,
  toSalesReportFilters,
} from "@/components/reports/sales/sales-report-filter-bar";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { useSalesByCashier } from "@/hooks/use-sales-reports";
import { getErrorMessage } from "@/lib/api/client";
import { salesReportFiltersSchema } from "@/lib/validators/sales-reports.schema";

function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
}

function defaultDraft(branchId: string): SalesReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    datePreset: "this_month",
    groupBy: "day",
  };
}

export function CashierSalesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const currentTimezone = useMemo(timezone, []);
  const initialDraft = useMemo(
    () => defaultDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<SalesReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toSalesReportFilters(initialDraft, currentTimezone));
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useSalesByCashier(filters, canView && hasScope);
  const topNetSales = (reportQuery.data ?? []).reduce(
    (top, row) => (row.netSales > top.netSales ? row : top),
    {
      cashierName: "-",
      netSales: 0,
      salesCount: 0,
      cashierUserId: "",
      itemsSold: 0,
      grossSales: 0,
      refundCount: 0,
      voidCount: 0,
    },
  );
  const topSalesCount = (reportQuery.data ?? []).reduce(
    (top, row) => (row.salesCount > top.salesCount ? row : top),
    topNetSales,
  );

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const applyFilters = (): void => {
    const next = toSalesReportFilters(draft, currentTimezone);
    const parsed = salesReportFiltersSchema.safeParse(next);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Sales report filters are invalid.");
      return;
    }
    setFilters(next);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Cashier Performance"
        description="Review cashier sales count, net sales, refunds, and voids."
      />
      <SalesReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toSalesReportFilters(initialDraft, currentTimezone))}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ReportKpiCard
          icon={UserRound}
          label="Highest Net Sales"
          value={`${topNetSales.cashierName} - ${formatCurrency(topNetSales.netSales)}`}
        />
        <ReportKpiCard
          icon={ReceiptText}
          label="Highest Sales Count"
          value={`${topSalesCount.cashierName} - ${formatNumber(topSalesCount.salesCount)}`}
        />
      </div>
      {reportQuery.error ? (
        <SalesReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-white/85 shadow-soft">
        <CardContent className="p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <CashierSalesTable rows={reportQuery.data} />
          ) : (
            <SalesReportEmptyState message="No cashier sales returned." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
