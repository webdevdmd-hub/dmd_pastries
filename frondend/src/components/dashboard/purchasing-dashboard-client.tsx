"use client";

import { PackageOpen, PackageSearch, ShoppingCart, Truck, WalletCards } from "lucide-react";
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
import { usePurchasingDashboard } from "@/hooks/use-dashboard";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

const actions = [
  { href: ROUTES.purchasingOrders, icon: ShoppingCart, label: "Create Purchase Order" },
  { href: ROUTES.purchasingReceipts, icon: PackageOpen, label: "Receive Stock" },
  { href: ROUTES.suppliers, icon: Truck, label: "View Suppliers" },
  { href: ROUTES.inventoryLowStock, icon: PackageSearch, label: "View Low Stock" },
] as const;

export function PurchasingDashboardClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([
    PERMISSIONS.dashboardView,
    PERMISSIONS.purchasingView,
    PERMISSIONS.inventoryView,
  ]);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const dashboardQuery = usePurchasingDashboard(canView && hasScope);

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const dashboard = dashboardQuery.data;
  const purchasingMetrics = [
    {
      icon: ShoppingCart,
      label: "Open Purchase Orders",
      value: formatNumber(dashboard?.purchasing.openPurchaseOrders ?? 0),
    },
    {
      icon: PackageOpen,
      label: "Pending Receipts",
      value: formatNumber(dashboard?.purchasing.pendingReceipts ?? 0),
    },
    {
      icon: WalletCards,
      label: "Supplier Payables",
      value: formatCurrency(dashboard?.purchasing.supplierPayables ?? 0),
    },
  ];
  const inventoryMetrics = [
    {
      icon: PackageSearch,
      label: "Low Stock Items",
      value: formatNumber(dashboard?.inventory.lowStockItems ?? 0),
    },
    {
      icon: PackageSearch,
      label: "Critical Low Stock",
      value: formatNumber(dashboard?.inventory.criticalLowStock ?? 0),
    },
    {
      icon: Truck,
      label: "Active Suppliers",
      value: formatNumber(dashboard?.suppliers.activeSuppliers ?? 0),
    },
  ];
  const purchasingPressure = [
    {
      label: "Open POs",
      value: dashboard?.purchasing.openPurchaseOrders ?? 0,
    },
    {
      label: "Pending receipts",
      value: dashboard?.purchasing.pendingReceipts ?? 0,
    },
    {
      label: "Critical stock",
      value: dashboard?.inventory.criticalLowStock ?? 0,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <DashboardPageHeader
        eyebrow="Purchasing intelligence"
        title="Purchasing Dashboard"
        description="Purchasing and inventory priorities for open orders, pending receipts, suppliers, and stock risk."
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
                description="Purchase order, receipt, and supplier payable pressure."
                metrics={purchasingMetrics}
                title="Purchasing Pipeline"
              />
              <DashboardMetricPanel
                description="Low stock exposure and available supplier base."
                metrics={inventoryMetrics}
                title="Inventory Supply Risk"
              />
            </div>
            <DashboardChartCard
              description="Open procurement work and critical stock risk."
              error={null}
              hasData={true}
              isLoading={false}
              onRetry={() => undefined}
              title="Purchasing Pressure"
            >
              <DashboardRiskChart items={purchasingPressure} />
            </DashboardChartCard>
          </div>
          <DashboardInsightRail actions={[...actions]} canLoad={true} />
        </div>
      )}
    </div>
  );
}
