"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReportSectionHeader } from "@/components/reports/report-section-header";
import { AccessDeniedCard } from "@/components/reports/sales/access-denied-card";
import { DiscountSalesTable } from "@/components/reports/sales/discount-sales-table";
import { DiscountSummaryCard } from "@/components/reports/sales/discount-summary-card";
import { SalesReportEmptyState } from "@/components/reports/sales/sales-report-empty-state";
import { SalesReportErrorState } from "@/components/reports/sales/sales-report-error-state";
import {
  SalesReportFilterBar,
  type SalesReportFilterDraft,
  toSalesReportFilters,
} from "@/components/reports/sales/sales-report-filter-bar";
import { SalesReportSkeleton } from "@/components/reports/sales/sales-report-skeleton";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { useDiscountReport } from "@/hooks/use-sales-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";
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

export function DiscountReportPageClient(): JSX.Element {
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
  // Zero rows means two different things on a report: nothing happened in
  // the default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = toSalesReportFilters(initialDraft, currentTimezone);
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useDiscountReport(filters, canView && hasScope);
  const reportError = reportQuery.error;
  const canShowReport = reportQuery.isSuccess && !reportError;
  const report = reportQuery.data;

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
      <ReportSectionHeader
        title="Discount Report"
        description="Review sale-level and line-level discounts."
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
      {reportQuery.isLoading && !reportError ? <SalesReportSkeleton /> : null}
      {reportError ? (
        <SalesReportErrorState
          description={getErrorMessage(reportError)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      {canShowReport && report ? (
        <>
          <DiscountSummaryCard report={report} />
          <Card className="bg-card/85 shadow-soft">
            <CardContent className="p-5">
              {report.items.length > 0 ? (
                <DiscountSalesTable rows={report.items} />
              ) : (
                <SalesReportEmptyState
                  isFiltered={isReportNarrowed}
                  message="No discounted sales returned in this period."
                  noun="discounted sales returned"
                  onClearFilters={() => setFilters(reportDefaultFilters)}
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
