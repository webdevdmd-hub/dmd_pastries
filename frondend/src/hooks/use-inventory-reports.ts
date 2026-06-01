"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getCurrentStockReport,
  getExpiryReport,
  getInventoryAuditReport,
  getInventoryMovementsReport,
  getInventorySummary,
  getInventoryTrend,
  getLowStockReport,
  getPackagingStockReport,
  getStockValuationReport,
  getWastageReport,
} from "@/lib/api/inventory-reports";
import type {
  CurrentStockRow,
  ExpiryReportRow,
  InventoryAuditRow,
  InventoryMovementReportRow,
  InventoryReportFilters,
  InventorySummary,
  InventoryTrendChart,
  LowStockRow,
  PackagingStockRow,
  StockValuationRow,
  WastageReport,
} from "@/types/inventory-reports";

const inventoryReportsQueryKey = "inventory-reports";

function useInventoryReportQuery<TData>(
  segment: string,
  filters: InventoryReportFilters,
  queryFn: () => Promise<TData>,
  enabled: boolean,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<TData>({
    enabled,
    queryFn,
    queryKey: [inventoryReportsQueryKey, branchQueryKey, segment, filters],
  });
}

export function useInventorySummary(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<InventorySummary>(
    "summary",
    filters,
    async () => getInventorySummary(filters),
    enabled,
  );
}

export function useCurrentStockReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<CurrentStockRow[]>(
    "current-stock",
    filters,
    async () => getCurrentStockReport(filters),
    enabled,
  );
}

export function useStockValuationReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<StockValuationRow[]>(
    "stock-valuation",
    filters,
    async () => getStockValuationReport(filters),
    enabled,
  );
}

export function useLowStockReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<LowStockRow[]>(
    "low-stock",
    filters,
    async () => getLowStockReport(filters),
    enabled,
  );
}

export function useExpiryReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<ExpiryReportRow[]>(
    "expiry",
    filters,
    async () => getExpiryReport(filters),
    enabled,
  );
}

export function useInventoryMovementsReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<InventoryMovementReportRow[]>(
    "movements",
    filters,
    async () => getInventoryMovementsReport(filters),
    enabled,
  );
}

export function useWastageReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<WastageReport>(
    "wastage",
    filters,
    async () => getWastageReport(filters),
    enabled,
  );
}

export function usePackagingStockReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<PackagingStockRow[]>(
    "packaging-stock",
    filters,
    async () => getPackagingStockReport(filters),
    enabled,
  );
}

export function useInventoryAuditReport(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<InventoryAuditRow[]>(
    "audit",
    filters,
    async () => getInventoryAuditReport(filters),
    enabled,
  );
}

export function useInventoryTrend(filters: InventoryReportFilters, enabled = true) {
  return useInventoryReportQuery<InventoryTrendChart>(
    "trend",
    filters,
    async () => getInventoryTrend(filters),
    enabled,
  );
}
