"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/inventory/access-denied-card";
import {
  InventoryAccountingReconciliationTable,
  InventoryAccountingUnassignedLinesTable,
} from "@/components/reports/inventory/inventory-accounting-reconciliation-table";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useInventoryAccountingReconciliationReport } from "@/hooks/use-inventory-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import type { InventoryReportFilters } from "@/types/inventory-reports";

const pageSize = 50;

const reconciliationStatusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Matched", value: "matched" },
  { label: "Mismatch", value: "mismatch" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function reconciliationFilters(filters: InventoryReportFilters, page = 1): InventoryReportFilters {
  return {
    ...filters,
    ...(filters.dateTo ? { asOfDate: filters.dateTo } : {}),
    limit: pageSize,
    page,
    sortBy: "difference_amount",
    sortOrder: "desc",
  };
}

function SummaryTile({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "danger";
  value: string;
}): JSX.Element {
  return (
    <Card className="bg-white/85 shadow-soft">
      <CardContent className="p-5">
        <p className="text-sm text-brand-mocha">{label}</p>
        <p
          className={
            tone === "danger"
              ? "mt-2 text-2xl font-semibold text-red-700"
              : "mt-2 text-2xl font-semibold text-brand-espresso"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function InventoryAccountingReconciliationPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) &&
    hasAnyPermission([PERMISSIONS.inventoryView]) &&
    hasAnyPermission([PERMISSIONS.accountingView]);
  const initialDraft = useMemo(
    () => defaultInventoryReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<InventoryReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() =>
    reconciliationFilters(toInventoryReportFilters(initialDraft)),
  );
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useInventoryAccountingReconciliationReport(filters, canView && hasScope);
  const report = reportQuery.data;
  const page = report?.pagination.page ?? filters.page ?? 1;
  const totalPages = report?.pagination.totalPages ?? 1;
  const unassignedLines = report?.unassignedAccountingLines ?? [];

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const applyFilters = (): void => {
    const next = parseInventoryReportDraft(draft);
    if (next) setFilters(reconciliationFilters(next));
  };

  const resetFilters = (): void => {
    setDraft(initialDraft);
    setFilters(reconciliationFilters(toInventoryReportFilters(initialDraft)));
  };

  const goToPage = (nextPage: number): void => {
    setFilters((current) => reconciliationFilters(current, nextPage));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Inventory Accounting Reconciliation"
        description="Compare operational stock valuation, stock movement valuation, linked accounting journals, and the mapped Inventory / Stock GL balance."
      />
      <InventoryReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        statusOptions={reconciliationStatusOptions}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={resetFilters}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryTile
          label="Operational value"
          value={formatMoney(report?.totalOperationalValue ?? 0)}
        />
        <SummaryTile
          label="Stock ledger value"
          value={formatMoney(report?.totalInventoryLedgerValue ?? 0)}
        />
        <SummaryTile
          label="Linked accounting value"
          value={formatMoney(report?.totalAccountingInventoryValue ?? 0)}
        />
        <SummaryTile
          label="Inventory / Stock GL"
          value={formatMoney(report?.generalLedgerInventoryBalance ?? 0)}
        />
        <SummaryTile
          label="Unassigned GL difference"
          tone={Math.abs(report?.unassignedAccountingDifference ?? 0) > 0.01 ? "danger" : "default"}
          value={formatMoney(report?.unassignedAccountingDifference ?? 0)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryTile label="Matched rows" value={String(report?.matchedCount ?? 0)} />
        <SummaryTile
          label="Mismatch rows"
          tone={(report?.mismatchCount ?? 0) > 0 ? "danger" : "default"}
          value={String(report?.mismatchCount ?? 0)}
        />
      </div>
      {unassignedLines.length > 0 ? (
        <Card className="border-red-100 bg-white/85 shadow-soft">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-brand-espresso">
                Unassigned Inventory / Stock GL Lines
              </h2>
              <p className="text-sm text-brand-mocha">
                {String(report?.unassignedAccountingLineCount ?? unassignedLines.length)} posted
                journal lines affect Inventory / Stock but are not linked to stock movements.
              </p>
            </div>
            <InventoryAccountingUnassignedLinesTable lines={unassignedLines} />
          </CardContent>
        </Card>
      ) : null}
      {reportQuery.error ? (
        <InventoryReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-white/85 shadow-soft">
        <CardContent className="p-5">
          {report && report.items.length > 0 ? (
            <InventoryAccountingReconciliationTable rows={report.items} />
          ) : (
            <InventoryReportEmptyState message="No inventory accounting reconciliation rows found." />
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-mocha">
          Page {page} of {Math.max(totalPages, 1)} | {report?.pagination.total ?? 0} rows
        </p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || reportQuery.isFetching}
            type="button"
            variant="outline"
            onClick={() => goToPage(Math.max(page - 1, 1))}
          >
            Previous
          </Button>
          <Button
            disabled={page >= totalPages || reportQuery.isFetching}
            type="button"
            variant="outline"
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
