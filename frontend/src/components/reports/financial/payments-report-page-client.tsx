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
import { PaymentMethodChart } from "@/components/reports/financial/payment-method-chart";
import { PaymentMethodReportCard } from "@/components/reports/financial/payment-method-report-card";
import { PaymentsReportTable } from "@/components/reports/financial/payments-report-table";
import { ReportChartCard } from "@/components/reports/report-chart-card";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePaymentMethodReport, usePaymentsReport } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";

export function PaymentsReportPageClient(): JSX.Element {
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
  const reportQuery = usePaymentsReport(filters, canView && hasScope);
  const methodsQuery = usePaymentMethodReport(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseFinancialReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Payments Report"
        description="Review collections by source, branch, payment method, status, and cashier."
      />
      <FinancialReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        refundStatusOptions={[]}
        sourceTypeOptions={[
          { label: "All payment sources", value: "all" },
          { label: "POS sale", value: "pos_sale" },
          { label: "Bakery order", value: "bakery_order" },
        ]}
        statusOptions={[
          { label: "Financial impact", value: "all" },
          { label: "Completed", value: "completed" },
          { label: "Partially refunded", value: "partially_refunded" },
          { label: "Refunded", value: "refunded" },
          { label: "Pending", value: "pending" },
          { label: "Failed", value: "failed" },
        ]}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toFinancialReportFilters(initialDraft))}
      />
      <PaymentMethodReportCard rows={methodsQuery.data ?? []} />
      <ReportChartCard
        caption="Payment method split and collected versus refunded amounts."
        error={methodsQuery.error}
        isEmpty={!methodsQuery.data || methodsQuery.data.length === 0}
        isLoading={methodsQuery.isLoading}
        title="Payment Method Performance"
        onRetry={() => void methodsQuery.refetch()}
      >
        {methodsQuery.data && methodsQuery.data.length > 0 ? (
          <PaymentMethodChart rows={methodsQuery.data} />
        ) : (
          <FinancialReportEmptyState message="No payment method data found." />
        )}
      </ReportChartCard>
      {reportQuery.error ? (
        <FinancialReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="overflow-x-auto p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <PaymentsReportTable rows={reportQuery.data} />
          ) : (
            <FinancialReportEmptyState message="No payments found." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
