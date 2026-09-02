"use client";

import { Truck, Wallet } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/financial/access-denied-card";
import { FinancialReportEmptyState } from "@/components/reports/financial/financial-report-empty-state";
import { FinancialReportErrorState } from "@/components/reports/financial/financial-report-error-state";
import {
  FinancialReportFilterBar,
  type FinancialReportFilterDraft,
  toFinancialReportFilters,
} from "@/components/reports/financial/financial-report-filter-bar";
import {
  defaultFinancialReportDraft,
  parseFinancialReportDraft,
} from "@/components/reports/financial/financial-report-page-utils";
import { ReportLedgerNotice } from "@/components/reports/financial/report-ledger-notice";
import { SupplierPayablesTable } from "@/components/reports/financial/supplier-payables-table";
import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportSectionHeader } from "@/components/reports/report-section-header";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useSupplierPayablesReport } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";

export function SupplierPayablesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const initialDraft = useMemo(
    () => defaultFinancialReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<FinancialReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toFinancialReportFilters(initialDraft));
  // Zero rows means two different things on a report: nothing happened in
  // the default period, or the user narrowed it. See report-empty-state.tsx.
  const reportDefaultFilters = toFinancialReportFilters(initialDraft);
  const isReportNarrowed = isReportFiltered(filters, reportDefaultFilters);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useSupplierPayablesReport(filters, canView && hasScope);
  const rows = reportQuery.data?.rows ?? [];
  // The headline figure is the payables control balance from the ledger; it
  // used to be the sum of the visible page only.
  const totalPayable = reportQuery.data?.header.ledgerBalance ?? 0;
  const supplierAdvances = reportQuery.data?.supplierAdvances ?? 0;
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseFinancialReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportSectionHeader
        title="Supplier Payables"
        description="Track unpaid supplier invoice balances and oldest due dates."
      />
      <FinancialReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        refundStatusOptions={[]}
        showGroupBy={false}
        sourceTypeOptions={[]}
        statusOptions={[]}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toFinancialReportFilters(initialDraft))}
      />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <ReportKpiCard
          icon={Truck}
          label="Total Supplier Payables"
          value={formatCurrency(totalPayable)}
        />
        <ReportKpiCard
          icon={Wallet}
          label="Supplier Advances"
          value={formatCurrency(supplierAdvances)}
        />
      </div>
      <ReportLedgerNotice
        sourceOfTruth={reportQuery.data?.sourceOfTruth ?? ""}
        warnings={reportQuery.data?.consistencyWarnings ?? []}
      />
      {reportQuery.error ? (
        <FinancialReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="overflow-x-auto p-5">
          {rows.length > 0 ? (
            <SupplierPayablesTable rows={rows} />
          ) : (
            <FinancialReportEmptyState
              isFiltered={isReportNarrowed}
              message="No supplier payables in this period."
              noun="supplier payables"
              onClearFilters={() => setFilters(reportDefaultFilters)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
