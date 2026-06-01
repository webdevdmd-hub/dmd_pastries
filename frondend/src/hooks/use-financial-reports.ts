"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getFinancialSummary,
  getFinancialTrend,
  getOutstandingBalancesReport,
  getPaymentMethodReport,
  getPaymentsReport,
  getPurchaseTotalsReport,
  getReconciliationReport,
  getRefundsReport,
  getSupplierPayablesReport,
} from "@/lib/api/financial-reports";
import type {
  FinancialReportFilters,
  FinancialSummary,
  FinancialTrendChart,
  OutstandingBalanceRow,
  PaymentMethodReportRow,
  PaymentsReportRow,
  PurchaseTotalsReport,
  ReconciliationRow,
  RefundReportRow,
  SupplierPayableRow,
} from "@/types/financial-reports";

const financialReportsQueryKey = "financial-reports";

function useFinancialReportQuery<TData>(
  segment: string,
  filters: FinancialReportFilters,
  queryFn: () => Promise<TData>,
  enabled: boolean,
) {
  const branchQueryKey = useBranchQueryKey();
  return useQuery<TData>({
    enabled,
    queryFn,
    queryKey: [financialReportsQueryKey, branchQueryKey, segment, filters],
  });
}

export function useFinancialSummary(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<FinancialSummary>(
    "summary",
    filters,
    async () => getFinancialSummary(filters),
    enabled,
  );
}

export function usePaymentsReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<PaymentsReportRow[]>(
    "payments",
    filters,
    async () => getPaymentsReport(filters),
    enabled,
  );
}

export function usePaymentMethodReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<PaymentMethodReportRow[]>(
    "payment-methods",
    filters,
    async () => getPaymentMethodReport(filters),
    enabled,
  );
}

export function useRefundsReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<RefundReportRow[]>(
    "refunds",
    filters,
    async () => getRefundsReport(filters),
    enabled,
  );
}

export function useOutstandingBalancesReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<OutstandingBalanceRow[]>(
    "outstanding-balances",
    filters,
    async () => getOutstandingBalancesReport(filters),
    enabled,
  );
}

export function useSupplierPayablesReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<SupplierPayableRow[]>(
    "supplier-payables",
    filters,
    async () => getSupplierPayablesReport(filters),
    enabled,
  );
}

export function usePurchaseTotalsReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<PurchaseTotalsReport>(
    "purchase-totals",
    filters,
    async () => getPurchaseTotalsReport(filters),
    enabled,
  );
}

export function useReconciliationReport(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<ReconciliationRow[]>(
    "reconciliation",
    filters,
    async () => getReconciliationReport(filters),
    enabled,
  );
}

export function useFinancialTrend(filters: FinancialReportFilters, enabled = true) {
  return useFinancialReportQuery<FinancialTrendChart>(
    "trend",
    filters,
    async () => getFinancialTrend(filters),
    enabled,
  );
}
