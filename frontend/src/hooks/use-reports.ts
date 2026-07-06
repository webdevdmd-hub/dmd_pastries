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
  getReportExportOptions,
  getReportsDashboardSummary,
  getSalesChart,
} from "@/lib/api/reports";
import type { Branch } from "@/types/branch";
import type { SaleReceipt } from "@/types/pos";
import type {
  ReceiptRecordRow,
  ReceiptRecordsFilters,
  ReportChartData,
  ReportExportOption,
  ReportExportPayload,
  ReportFilters,
  ReportsDashboardSummary,
} from "@/types/reports";

const reportsQueryKey = "reports";
const reportsRefreshMs = 60_000;

export function useReportsDashboardSummary(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportsDashboardSummary>({
    queryKey: [reportsQueryKey, branchQueryKey, "dashboard-summary", filters],
    queryFn: async () => getReportsDashboardSummary(filters),
    enabled,
    refetchInterval: reportsRefreshMs,
  });
}

export const useDashboardSummary = useReportsDashboardSummary;

export function useSalesReportChart(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportChartData>({
    queryKey: [reportsQueryKey, branchQueryKey, "chart", "sales", filters],
    queryFn: async () => getSalesChart(filters),
    enabled,
    refetchInterval: reportsRefreshMs,
  });
}

export const useSalesChart = useSalesReportChart;

export function usePaymentsReportChart(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportChartData>({
    queryKey: [reportsQueryKey, branchQueryKey, "chart", "payments", filters],
    queryFn: async () => getPaymentsChart(filters),
    enabled,
    refetchInterval: reportsRefreshMs,
  });
}

export const usePaymentsChart = usePaymentsReportChart;

export function useOrdersReportChart(filters: ReportFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReportChartData>({
    queryKey: [reportsQueryKey, branchQueryKey, "chart", "orders", filters],
    queryFn: async () => getOrdersChart(filters),
    enabled,
    refetchInterval: reportsRefreshMs,
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

export function useReportExportOptions(enabled = true) {
  return useQuery<ReportExportOption[]>({
    queryKey: [reportsQueryKey, "export-options"],
    queryFn: async () => getReportExportOptions(),
    enabled,
  });
}

export function useReportBranches(enabled = true) {
  return useQuery<Branch[]>({
    queryKey: [reportsQueryKey, "branches"],
    queryFn: async () => getReportBranches(),
    enabled,
  });
}
