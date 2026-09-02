"use client";

import { ReceiptText } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";

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
import { OutstandingBalancesTable } from "@/components/reports/financial/outstanding-balances-table";
import { ReportLedgerNotice } from "@/components/reports/financial/report-ledger-notice";
import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportSectionHeader } from "@/components/reports/report-section-header";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useOutstandingBalancesReport } from "@/hooks/use-financial-reports";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import { isReportFiltered } from "@/lib/reports/is-report-filtered";

import { AccessDeniedCard } from "./access-denied-card";

export function OutstandingBalancesPageClient(): JSX.Element {
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
  const reportQuery = useOutstandingBalancesReport(filters, canView && hasScope);
  const rows = reportQuery.data?.rows ?? [];
  // The headline figure is the receivables control balance from the ledger.
  // It used to be the sum of the visible page, which understated the total
  // whenever the report ran to more than one page.
  const totalBalance = reportQuery.data?.header.ledgerBalance ?? 0;
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseFinancialReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportSectionHeader
        title="Outstanding Balances"
        description="Track unpaid and partial customer balances across POS and bakery order sources."
      />
      <FinancialReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        refundStatusOptions={[]}
        showGroupBy={false}
        sourceTypeOptions={[
          { label: "All customer sources", value: "all" },
          { label: "POS sale", value: "pos_sale" },
          { label: "Bakery order", value: "bakery_order" },
        ]}
        statusOptions={[]}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toFinancialReportFilters(initialDraft))}
      />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <ReportKpiCard
          icon={ReceiptText}
          label="Total Outstanding Balance"
          value={formatCurrency(totalBalance)}
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
            <OutstandingBalancesTable rows={rows} />
          ) : (
            <FinancialReportEmptyState
              isFiltered={isReportNarrowed}
              message="No outstanding balances in this period."
              noun="outstanding balances"
              onClearFilters={() => setFilters(reportDefaultFilters)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
