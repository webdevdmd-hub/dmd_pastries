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
import { RecipeCostTable } from "@/components/reports/manufacturing/recipe-cost-table";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useRecipeCostReport } from "@/hooks/use-manufacturing-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";

export function RecipeCostReportPageClient(): JSX.Element {
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
  const reportQuery = useRecipeCostReport(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseManufacturingReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Recipe Costs"
        description="Review ingredient, packaging, total cost, cost per yield unit, and active recipe versions."
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
      {reportQuery.error ? (
        <ManufacturingReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <RecipeCostTable rows={reportQuery.data} />
          ) : (
            <ManufacturingReportEmptyState message="No recipe cost rows in this period." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
