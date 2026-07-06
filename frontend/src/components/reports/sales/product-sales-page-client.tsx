"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReportPageHeader } from "@/components/reports/report-page-header";
import { AccessDeniedCard } from "@/components/reports/sales/access-denied-card";
import { ProductSalesTable } from "@/components/reports/sales/product-sales-table";
import { SalesReportEmptyState } from "@/components/reports/sales/sales-report-empty-state";
import { SalesReportErrorState } from "@/components/reports/sales/sales-report-error-state";
import {
  SalesReportFilterBar,
  type SalesReportFilterDraft,
  toSalesReportFilters,
} from "@/components/reports/sales/sales-report-filter-bar";
import { SalesReportSkeleton } from "@/components/reports/sales/sales-report-skeleton";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { useSalesByProduct } from "@/hooks/use-sales-reports";
import { getErrorMessage } from "@/lib/api/client";
import { salesReportFiltersSchema } from "@/lib/validators/sales-reports.schema";
import type { SalesReportFilters } from "@/types/sales-reports";

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

export function ProductSalesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const currentTimezone = useMemo(timezone, []);
  const initialDraft = useMemo(
    () => defaultDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<SalesReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState<SalesReportFilters>(() => ({
    ...toSalesReportFilters(initialDraft, currentTimezone),
    limit: 25,
    page: 1,
    sortBy: "net_sales",
    sortOrder: "desc",
  }));
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useSalesByProduct(filters, canView && hasScope);
  const reportError = reportQuery.error;
  const canShowReport = reportQuery.isSuccess && !reportError;
  const rows = reportQuery.data ?? [];

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const applyFilters = (): void => {
    const next: SalesReportFilters = {
      ...toSalesReportFilters(draft, currentTimezone),
      limit: 25,
      page: 1,
      ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
      ...(filters.sortOrder ? { sortOrder: filters.sortOrder } : {}),
    };
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
        title="Product Sales"
        description="Review product-level quantity sold, gross sales, discounts, taxes, and net sales."
        actions={<Button variant="outline">Export placeholder</Button>}
      />
      <SalesReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() =>
          setFilters({ ...toSalesReportFilters(initialDraft, currentTimezone), limit: 25, page: 1 })
        }
      />
      {reportQuery.isLoading && !reportError ? <SalesReportSkeleton /> : null}
      {reportError ? (
        <SalesReportErrorState
          description={getErrorMessage(reportError)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      {canShowReport ? (
        <Card className="bg-white/85 shadow-soft">
          <CardContent className="p-5">
            {rows.length > 0 ? (
              <ProductSalesTable rows={rows} />
            ) : (
              <SalesReportEmptyState message="No product sales returned." />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
