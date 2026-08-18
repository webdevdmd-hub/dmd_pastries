"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/reports/bakery-orders/access-denied-card";
import { BakeryOrdersReportEmptyState } from "@/components/reports/bakery-orders/bakery-orders-report-empty-state";
import { BakeryOrdersReportErrorState } from "@/components/reports/bakery-orders/bakery-orders-report-error-state";
import {
  BakeryOrdersReportFilterBar,
  type BakeryOrdersReportFilterDraft,
  toBakeryOrdersReportFilters,
} from "@/components/reports/bakery-orders/bakery-orders-report-filter-bar";
import {
  defaultBakeryOrdersReportDraft,
  parseBakeryOrdersReportDraft,
} from "@/components/reports/bakery-orders/bakery-orders-report-page-utils";
import { OrderStatusChart } from "@/components/reports/bakery-orders/order-status-chart";
import { OrderStatusTable } from "@/components/reports/bakery-orders/order-status-table";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useOrderStatusReport } from "@/hooks/use-bakery-orders-reports";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";

export function OrderStatusReportPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView =
    hasAnyPermission([PERMISSIONS.reportsView]) && hasAnyPermission([PERMISSIONS.ordersView]);
  const initialDraft = useMemo(
    () => defaultBakeryOrdersReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<BakeryOrdersReportFilterDraft>(initialDraft);
  const [filters, setFilters] = useState(() => toBakeryOrdersReportFilters(initialDraft));
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const reportQuery = useOrderStatusReport(filters, canView && hasScope);
  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;
  const applyFilters = (): void => {
    const next = parseBakeryOrdersReportDraft(draft);
    if (next) setFilters(next);
  };
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Order Status Report"
        description="Review order status distribution and value."
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
      />
      {reportQuery.error ? (
        <BakeryOrdersReportErrorState
          description={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : null}
      <Card className="bg-card/85 shadow-soft">
        <CardContent className="space-y-6 p-5">
          {reportQuery.data && reportQuery.data.length > 0 ? (
            <>
              <OrderStatusChart rows={reportQuery.data} />
              <OrderStatusTable rows={reportQuery.data} />
            </>
          ) : (
            <BakeryOrdersReportEmptyState message="No order status rows in this period." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
