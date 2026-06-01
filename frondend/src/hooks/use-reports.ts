"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import { getSaleReceipt } from "@/lib/api/pos";
import {
  exportReportCsv,
  getOrdersChart,
  getPaymentsChart,
  getReceiptRecords,
  getReportBranches,
  getReportsDashboardSummary,
  getSalesChart,
} from "@/lib/api/reports";
import type { Branch } from "@/types/branch";
import type { SaleReceipt } from "@/types/pos";
import type {
  ReceiptRecordRow,
  ReceiptRecordsFilters,
  ReportChartData,
  ReportExportPayload,
  ReportFilters,
  ReportsDashboardSummary,
} from "@/types/reports";

const reportsQueryKey = "reports";

export function useReportsDashboardSummary(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportsDashboardSummary>({
    queryKey: [reportsQueryKey, branchQueryKey, "dashboard-summary", filters],
    queryFn: async () => getReportsDashboardSummary(filters),
    enabled,
  });
}

export const useDashboardSummary = useReportsDashboardSummary;

export function useSalesReportChart(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportChartData>({
    queryKey: [reportsQueryKey, branchQueryKey, "chart", "sales", filters],
    queryFn: async () => getSalesChart(filters),
    enabled,
  });
}

export const useSalesChart = useSalesReportChart;

export function usePaymentsReportChart(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportChartData>({
    queryKey: [reportsQueryKey, branchQueryKey, "chart", "payments", filters],
    queryFn: async () => getPaymentsChart(filters),
    enabled,
  });
}

export const usePaymentsChart = usePaymentsReportChart;

export function useOrdersReportChart(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportChartData>({
    queryKey: [reportsQueryKey, branchQueryKey, "chart", "orders", filters],
    queryFn: async () => getOrdersChart(filters),
    enabled,
  });
}

export const useOrdersChart = useOrdersReportChart;

export function useReceiptRecords(filters: ReceiptRecordsFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReceiptRecordRow[]>({
    queryKey: [reportsQueryKey, branchQueryKey, "receipts", filters],
    queryFn: async () => getReceiptRecords(filters),
    enabled,
  });
}

export function useSaleReceipt() {
  return useMutation<SaleReceipt, Error, string>({
    mutationFn: async (saleId) => getSaleReceipt(saleId),
  });
}

export function useExportReportCsv() {
  return useMutation<Blob, Error, ReportExportPayload>({
    mutationFn: async (payload) => exportReportCsv(payload),
  });
}

export function useReportBranches(enabled = true) {
  return useQuery<Branch[]>({
    queryKey: [reportsQueryKey, "branches"],
    queryFn: async () => getReportBranches(),
    enabled,
  });
}
