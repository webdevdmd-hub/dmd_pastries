"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/manufacturing/access-denied-card";
import { ManufacturingReportEmptyState } from "@/components/reports/manufacturing/manufacturing-report-empty-state";
import { ManufacturingReportErrorState } from "@/components/reports/manufacturing/manufacturing-report-error-state";
import {
  ManufacturingReportFilterBar,
  type ManufacturingReportFilterDraft,
  toManufacturingReportFilters,
} from "@/components/reports/manufacturing/manufacturing-report-filter-bar";
import {
  defaultManufacturingReportDraft,
  parseManufacturingReportDraft,
} from "@/components/reports/manufacturing/manufacturing-report-page-utils";
import { ProductionBatchesTable } from "@/components/reports/manufacturing/production-batches-table";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useProductionBatchReport } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";

export function ProductionBatchesReportPageClient(): JSX.Element {
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
  const [filters, setFilters] = useState(() => ({
    ...toManufacturingReportFilters(initialDraft),
    limit: 25,
    page: 1,
  }));
  // Zero rows means two different things on a report: nothing happened in
  // the default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = {
    ...toManufacturingReportFilters(initialDraft),
    limit: 25,
    page: 1,
  };
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useProductionBatchReport(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseManufacturingReportDraft(draft);
    if (next) setFilters({ ...next, limit: 25, page: 1 });
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Production Batches"
        description="Review planned quantity, produced quantity, variance, efficiency, and batch status."
      />
      <ManufacturingReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() =>
          setFilters({ ...toManufacturingReportFilters(initialDraft), limit: 25, page: 1 })
        }
      />
      {reportQuery.error ? (
        <ManufacturingReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <ProductionBatchesTable rows={reportQuery.data} />
          ) : (
            <ManufacturingReportEmptyState
              isFiltered={isReportNarrowed}
              message="No production batches in this period."
              noun="production batches"
              onClearFilters={() => setFilters(reportDefaultFilters)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
