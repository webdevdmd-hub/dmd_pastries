"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getBakeryOrdersSummary,
  getBakeryOrdersTrend,
  getDeliveryVsPickupReport,
  getOrderStatusReport,
  getPendingPaymentsReport,
  getProductionScheduleReport,
  getUpcomingOrdersReport,
} from "@/lib/api/bakery-orders-reports";
import type {
  BakeryOrdersReportFilters,
  BakeryOrdersSummary,
  BakeryOrdersTrendChart,
  DeliveryVsPickupReport,
  OrderStatusRow,
  PendingPaymentRow,
  ProductionScheduleRow,
  UpcomingOrderRow,
} from "@/types/bakery-orders-reports";

const bakeryOrdersReportsQueryKey = "bakery-orders-reports";

function useBakeryOrdersReportQuery<TData>(
  segment: string,
  filters: BakeryOrdersReportFilters,
  queryFn: () => Promise<TData>,
  enabled: boolean,
) {
  const branchQueryKey = useBranchQueryKey();
  return useQuery<TData>({
    enabled,
    queryFn,
    queryKey: [bakeryOrdersReportsQueryKey, branchQueryKey, segment, filters],
  });
}

export function useBakeryOrdersSummary(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<BakeryOrdersSummary>(
    "summary",
    filters,
    async () => getBakeryOrdersSummary(filters),
    enabled,
  );
}

export function useUpcomingOrdersReport(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<UpcomingOrderRow[]>(
    "upcoming",
    filters,
    async () => getUpcomingOrdersReport(filters),
    enabled,
  );
}

export function useOrderStatusReport(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<OrderStatusRow[]>(
    "status",
    filters,
    async () => getOrderStatusReport(filters),
    enabled,
  );
}

export function useProductionScheduleReport(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<ProductionScheduleRow[]>(
    "production-schedule",
    filters,
    async () => getProductionScheduleReport(filters),
    enabled,
  );
}

export function usePendingPaymentsReport(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<PendingPaymentRow[]>(
    "pending-payments",
    filters,
    async () => getPendingPaymentsReport(filters),
    enabled,
  );
}

export function useDeliveryVsPickupReport(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<DeliveryVsPickupReport>(
    "delivery-vs-pickup",
    filters,
    async () => getDeliveryVsPickupReport(filters),
    enabled,
  );
}

export function useBakeryOrdersTrend(filters: BakeryOrdersReportFilters, enabled = true) {
  return useBakeryOrdersReportQuery<BakeryOrdersTrendChart>(
    "trend",
    filters,
    async () => getBakeryOrdersTrend(filters),
    enabled,
  );
}
