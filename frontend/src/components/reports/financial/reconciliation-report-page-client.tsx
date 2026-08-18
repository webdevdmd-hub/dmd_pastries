"use client";

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
import { ReconciliationReportTable } from "@/components/reports/financial/reconciliation-report-table";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useReconciliationReport } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";

export function ReconciliationReportPageClient(): JSX.Element {
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
  const reportQuery = useReconciliationReport(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseFinancialReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Reconciliation Report"
        description="Review completed collection, refund, and supplier-payment transactions by branch and method."
      />
      <FinancialReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        refundStatusOptions={[]}
        sourceTypeOptions={[
          { label: "Customer activity", value: "all" },
          { label: "POS sale", value: "pos_sale" },
          { label: "Bakery order", value: "bakery_order" },
          { label: "Sales return", value: "sales_return" },
          { label: "Supplier payment", value: "supplier_payment" },
          { label: "Invoice payment", value: "purchase_invoice_payment" },
        ]}
        statusOptions={[
          { label: "Financial impact", value: "all" },
          { label: "Completed", value: "completed" },
          { label: "Partially refunded", value: "partially_refunded" },
          { label: "Refunded", value: "refunded" },
          { label: "Voided", value: "voided" },
        ]}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toFinancialReportFilters(initialDraft))}
      />
      {reportQuery.error ? (
        <FinancialReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="overflow-x-auto p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <ReconciliationReportTable rows={reportQuery.data} />
          ) : (
            <FinancialReportEmptyState
              isFiltered={isReportNarrowed}
              message="No financial transactions in this period."
              noun="financial transactions"
              onClearFilters={() => setFilters(reportDefaultFilters)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
