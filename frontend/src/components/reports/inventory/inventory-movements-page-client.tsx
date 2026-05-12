"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/inventory/access-denied-card";
import { InventoryMovementsTable } from "@/components/reports/inventory/inventory-movements-table";
import { InventoryReportEmptyState } from "@/components/reports/inventory/inventory-report-empty-state";
import { InventoryReportErrorState } from "@/components/reports/inventory/inventory-report-error-state";
import {
  InventoryReportFilterBar,
  type InventoryReportFilterDraft,
  toInventoryReportFilters,
} from "@/components/reports/inventory/inventory-report-filter-bar";
import {
  defaultInventoryReportDraft,
  parseInventoryReportDraft,
} from "@/components/reports/inventory/inventory-report-page-utils";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useInventoryMovementsReport } from "@/hooks/use-inventory-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";

export function InventoryMovementsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) && hasAnyPermission([PERMISSIONS.inventoryView]);
  const initialDraft = useMemo(
    () => defaultInventoryReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<InventoryReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toInventoryReportFilters(initialDraft));
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useInventoryMovementsReport(filters, canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const applyFilters = (): void => {
    const next = parseInventoryReportDraft(draft);
    if (next) setFilters(next);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Stock Movements"
        description="Review stock movement ledger activity by item, branch, reference, and user."
      />
      <InventoryReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toInventoryReportFilters(initialDraft))}
      />
      {reportQuery.error ? (
        <InventoryReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-white/85 shadow-soft">
        <CardContent className="p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <InventoryMovementsTable rows={reportQuery.data} />
          ) : (
            <InventoryReportEmptyState message="No inventory movements found." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
