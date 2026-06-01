"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getDailySales,
  getDiscountReport,
  getSalesByBranch,
  getSalesByCashier,
  getSalesByCategory,
  getSalesByProduct,
  getSalesSummary,
  getSalesTrend,
  getSlowMovingProducts,
  getTaxReport,
  getTopProducts,
} from "@/lib/api/sales-reports";
import type {
  BranchSalesRow,
  CashierSalesRow,
  CategorySalesRow,
  DailySalesRow,
  DiscountReport,
  ProductSalesRow,
  SalesReportFilters,
  SalesSummary,
  SalesTrendChart,
  TaxReportRow,
} from "@/types/sales-reports";

const salesReportsQueryKey = "sales-reports";

function useSalesReportQuery<TData>(
  segment: string,
  filters: SalesReportFilters,
  queryFn: () => Promise<TData>,
  enabled: boolean,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<TData>({
    queryKey: [salesReportsQueryKey, branchQueryKey, segment, filters],
    queryFn,
    enabled,
  });
}

export function useSalesSummary(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<SalesSummary>(
    "summary",
    filters,
    async () => getSalesSummary(filters),
    enabled,
  );
}

export function useDailySales(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<DailySalesRow[]>(
    "daily",
    filters,
    async () => getDailySales(filters),
    enabled,
  );
}

export function useSalesByProduct(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<ProductSalesRow[]>(
    "by-product",
    filters,
    async () => getSalesByProduct(filters),
    enabled,
  );
}

export function useSalesByCategory(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<CategorySalesRow[]>(
    "by-category",
    filters,
    async () => getSalesByCategory(filters),
    enabled,
  );
}

export function useSalesByCashier(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<CashierSalesRow[]>(
    "by-cashier",
    filters,
    async () => getSalesByCashier(filters),
    enabled,
  );
}

export function useSalesByBranch(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<BranchSalesRow[]>(
    "by-branch",
    filters,
    async () => getSalesByBranch(filters),
    enabled,
  );
}

export function useDiscountReport(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<DiscountReport>(
    "discounts",
    filters,
    async () => getDiscountReport(filters),
    enabled,
  );
}

export function useTaxReport(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<TaxReportRow[]>(
    "taxes",
    filters,
    async () => getTaxReport(filters),
    enabled,
  );
}

export function useTopProducts(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<ProductSalesRow[]>(
    "top-products",
    filters,
    async () => getTopProducts(filters),
    enabled,
  );
}

export function useSlowMovingProducts(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<ProductSalesRow[]>(
    "slow-moving-products",
    filters,
    async () => getSlowMovingProducts(filters),
    enabled,
  );
}

export function useSalesTrend(filters: SalesReportFilters, enabled = true) {
  return useSalesReportQuery<SalesTrendChart>(
    "trend",
    filters,
    async () => getSalesTrend(filters),
    enabled,
  );
}
