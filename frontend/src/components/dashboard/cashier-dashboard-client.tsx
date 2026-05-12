"use client";

import {
  CreditCard,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/dashboard/access-denied-card";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import { DashboardErrorState } from "@/components/dashboard/dashboard-error-state";
import { DashboardInsightRail } from "@/components/dashboard/dashboard-insight-rail";
import { DashboardMetricPanel } from "@/components/dashboard/dashboard-metric-panel";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardRiskChart } from "@/components/dashboard/dashboard-risk-chart";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useCashierDashboard } from "@/hooks/use-dashboard";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

const actions = [
  { href: ROUTES.pos, icon: ReceiptText, label: "Open POS Billing" },
  { href: ROUTES.customers, icon: UserRound, label: "Create Customer" },
  { href: ROUTES.orders, icon: ShoppingBag, label: "View Ready Orders" },
  { href: ROUTES.payments, icon: WalletCards, label: "Add Payment" },
] as const;

export function CashierDashboardClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([
    PERMISSIONS.dashboardView,
    PERMISSIONS.posView,
    PERMISSIONS.posSell,
    PERMISSIONS.posCheckout,
  ]);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const dashboardQuery = useCashierDashboard(canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const dashboard = dashboardQuery.data;
  const salesMetrics = [
    {
      icon: ReceiptText,
      label: "Today Sales",
      value: formatCurrency(dashboard?.sales.todaySales ?? 0),
    },
    {
      icon: ReceiptText,
      label: "Sales Count",
      value: formatNumber(dashboard?.sales.salesCount ?? 0),
    },
    {
      icon: RotateCcw,
      label: "Refund Count",
      value: formatNumber(dashboard?.sales.refundCount ?? 0),
    },
  ];
  const paymentMetrics = [
    {
      icon: WalletCards,
      label: "Cash Collected",
      value: formatCurrency(dashboard?.payments.cashCollected ?? 0),
    },
    {
      icon: CreditCard,
      label: "Card Collected",
      value: formatCurrency(dashboard?.payments.cardCollected ?? 0),
    },
    {
      icon: WalletCards,
      label: "Shift Collected",
      value: formatCurrency(dashboard?.shiftSummary.shiftCollected ?? 0),
    },
  ];
  const orderReadiness = [
    {
      label: "Pickup ready",
      value: dashboard?.orders.pickupReady ?? 0,
    },
    {
      label: "Delivery ready",
      value: dashboard?.orders.deliveryReady ?? 0,
    },
    {
      label: "Refunds",
      value: dashboard?.sales.refundCount ?? 0,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <DashboardPageHeader
        eyebrow="Cashier intelligence"
        title="Cashier Dashboard"
        description="Daily register priorities for sales, collections, refunds, and ready customer orders."
      />
      {dashboardQuery.error ? (
        <DashboardErrorState
          description={getErrorMessage(dashboardQuery.error)}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}
      {dashboardQuery.isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.85fr)]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardMetricPanel
                description="Register sales, ticket count, and refund pressure for today."
                metrics={salesMetrics}
                title="Register Performance"
              />
              <DashboardMetricPanel
                description="Cash, card, and active shift collection snapshot."
                metrics={paymentMetrics}
                title="Collection Mix"
              />
            </div>
            <DashboardChartCard
              description="Ready pickup and delivery order workload for the counter."
              error={null}
              hasData={true}
              isLoading={false}
              onRetry={() => undefined}
              title="Order Readiness"
            >
              <DashboardRiskChart items={orderReadiness} />
            </DashboardChartCard>
          </div>
          <DashboardInsightRail actions={[...actions]} canLoad={true} />
        </div>
      )}
    </div>
  );
}
