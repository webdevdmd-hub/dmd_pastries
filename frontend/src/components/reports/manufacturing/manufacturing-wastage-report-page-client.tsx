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
import { ManufacturingWastageSummaryCard } from "@/components/reports/manufacturing/manufacturing-wastage-summary-card";
import { ManufacturingWastageTable } from "@/components/reports/manufacturing/manufacturing-wastage-table";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useManufacturingWastageReport } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";

export function ManufacturingWastageReportPageClient(): JSX.Element {
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
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useManufacturingWastageReport(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseManufacturingReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Manufacturing Wastage"
        description="Track ingredient and finished goods wastage by batch and reason."
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
      <ManufacturingWastageSummaryCard report={reportQuery.data} />
      {reportQuery.error ? (
        <ManufacturingReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="p-5">
          {reportQuery.data && reportQuery.data.items.length > 0 ? (
            <ManufacturingWastageTable rows={reportQuery.data.items} />
          ) : (
            <ManufacturingReportEmptyState message="No manufacturing wastage in this period." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
