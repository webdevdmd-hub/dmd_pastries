"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/reports/bakery-orders/access-denied-card";
import { BakeryOrdersReportEmptyState } from "@/components/reports/bakery-orders/bakery-orders-report-empty-state";
import { BakeryOrdersReportErrorState } from "@/components/reports/bakery-orders/bakery-orders-report-error-state";
import {
  BakeryOrdersReportFilterBar,
  type BakeryOrdersReportFilterDraft,
  toBakeryOrdersReportFilters,
} from "@/components/reports/bakery-orders/bakery-orders-report-filter-bar";
import { defaultBakeryOrdersReportDraft } from "@/components/reports/bakery-orders/bakery-orders-report-page-utils";
import { PendingPaymentsSummaryCard } from "@/components/reports/bakery-orders/pending-payments-summary-card";
import { PendingPaymentsTable } from "@/components/reports/bakery-orders/pending-payments-table";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { usePendingPaymentsReport } from "@/hooks/use-bakery-orders-reports";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import { bakeryOrdersPendingPaymentsFiltersSchema } from "@/lib/validators/bakery-orders-reports.schema";
import type { BakeryOrdersReportFilters } from "@/types/bakery-orders-reports";

const pendingPaymentStatusOptions = [
  { label: "All pending", value: "all" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
];

function defaultPendingPaymentsDraft(branchId: string): BakeryOrdersReportFilterDraft {
  return {
    ...defaultBakeryOrdersReportDraft(branchId),
    dateFrom: "",
    datePreset: "custom",
    dateTo: "",
  };
}

function parsePendingPaymentsDraft(
  draft: BakeryOrdersReportFilterDraft,
): BakeryOrdersReportFilters | null {
  const filters = toBakeryOrdersReportFilters(draft);
  const parsed = bakeryOrdersPendingPaymentsFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    toast.error(parsed.error.errors[0]?.message ?? "Pending payments filters are invalid.");
    return null;
  }
  return filters;
}

export function PendingPaymentsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) && hasAnyPermission([PERMISSIONS.ordersView]);
  const initialDraft = useMemo(
    () => defaultPendingPaymentsDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<BakeryOrdersReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toBakeryOrdersReportFilters(initialDraft));
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = usePendingPaymentsReport(filters, canView && hasScope);
  const report = reportQuery.data;
  const orders = report?.orders ?? [];
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parsePendingPaymentsDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Pending Payments"
        description="Review customer balances for custom bakery orders."
      />
      <BakeryOrdersReportFilterBar
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        currentBranchId={branchScope.effectiveBranchId}
        defaultFilters={initialDraft}
        filters={draft}
        onApply={applyFilters}
        onChange={setDraft}
        onReset={() => setFilters(toBakeryOrdersReportFilters(initialDraft))}
        paymentStatusOptions={pendingPaymentStatusOptions}
      />
      {!reportQuery.error ? (
        <PendingPaymentsSummaryCard totalPendingBalance={report?.totalPendingBalance ?? 0} />
      ) : null}
      {reportQuery.error ? (
        <BakeryOrdersReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      {!reportQuery.error ? (
        <Card className="bg-card/85 shadow-soft">
          <CardContent className="p-5">
            {orders.length > 0 ? (
              <PendingPaymentsTable rows={orders} />
            ) : (
              <BakeryOrdersReportEmptyState message="No pending payments found." />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
