"use client";

import { Truck } from "lucide-react";
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
import { SupplierPayablesTable } from "@/components/reports/financial/supplier-payables-table";
import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useSupplierPayablesReport } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";

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
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useSupplierPayablesReport(filters, canView && hasScope);
  const totalPayable = (reportQuery.data ?? []).reduce((sum, row) => sum + row.payableBalance, 0);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseFinancialReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportKpiCard
          icon={Truck}
          label="Total Supplier Payables"
          value={formatCurrency(totalPayable)}
        />
      </div>
      {reportQuery.error ? (
        <FinancialReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-white/85 shadow-soft">
        <CardContent className="overflow-x-auto p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <SupplierPayablesTable rows={reportQuery.data} />
          ) : (
            <FinancialReportEmptyState message="No supplier payables found." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
