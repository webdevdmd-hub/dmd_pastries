"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  type DashboardRequestFilters,
  getAdminDashboard,
  getCashierDashboard,
  getDashboardAlerts,
  getKpiSummary,
  getProductionDashboard,
  getPurchasingDashboard,
  getRecentActivity,
} from "@/lib/api/dashboard";
import type {
  AdminDashboard,
  CashierDashboard,
  DashboardActivity,
  DashboardAlert,
  KpiSummary,
  ProductionDashboard,
  PurchasingDashboard,
} from "@/types/dashboard";

const dashboardQueryKey = "dashboard";
const dashboardRefreshMs = 60_000;
const alertsRefreshMs = 30_000;

function useDashboardQuery<TData>(
  segment: string,
  queryFn: () => Promise<TData>,
  enabled: boolean,
  refetchInterval = dashboardRefreshMs,
  keyArgs?: unknown,
) {
  const branchQueryKey = useBranchQueryKey();
  return useQuery<TData>({
    enabled,
    queryFn,
    queryKey: [dashboardQueryKey, branchQueryKey, segment, keyArgs],
    refetchInterval,
  });
}

export function useAdminDashboard(filters?: DashboardRequestFilters, enabled = true) {
  return useDashboardQuery<AdminDashboard>(
    "admin",
    async () => getAdminDashboard(filters),
    enabled,
    dashboardRefreshMs,
    filters,
  );
}

export function useCashierDashboard(enabled = true) {
  return useDashboardQuery<CashierDashboard>("cashier", getCashierDashboard, enabled);
}

export function useProductionDashboard(enabled = true) {
  return useDashboardQuery<ProductionDashboard>("production", getProductionDashboard, enabled);
}

export function usePurchasingDashboard(enabled = true) {
  return useDashboardQuery<PurchasingDashboard>("purchasing", getPurchasingDashboard, enabled);
}

export function useRecentActivity(enabled = true) {
  return useDashboardQuery<DashboardActivity[]>(
    "recent-activity",
    getRecentActivity,
    enabled,
    dashboardRefreshMs,
  );
}

export function useDashboardAlerts(
  filters?: Pick<DashboardRequestFilters, "timezone">,
  enabled = true,
) {
  return useDashboardQuery<DashboardAlert[]>(
    "alerts",
    async () => getDashboardAlerts(filters),
    enabled,
    alertsRefreshMs,
    filters,
  );
}

export function useKpiSummary(enabled = true) {
  return useDashboardQuery<KpiSummary>("kpi-summary", getKpiSummary, enabled);
}
