"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getIngredientConsumptionReport,
  getManufacturingSummary,
  getManufacturingTrend,
  getManufacturingWastageReport,
  getProductionBatchReport,
  getRecipeCostReport,
  getYieldVarianceReport,
} from "@/lib/api/manufacturing-reports";
import type {
  IngredientConsumptionRow,
  ManufacturingReportFilters,
  ManufacturingSummary,
  ManufacturingTrendChart,
  ManufacturingWastageReport,
  ProductionBatchReportRow,
  RecipeCostReportRow,
  YieldVarianceRow,
} from "@/types/manufacturing-reports";

const manufacturingReportsQueryKey = "manufacturing-reports";

function useManufacturingReportQuery<TData>(
  segment: string,
  filters: ManufacturingReportFilters,
  queryFn: () => Promise<TData>,
  enabled: boolean,
) {
  const branchQueryKey = useBranchQueryKey();
  return useQuery<TData>({
    enabled,
    queryFn,
    queryKey: [manufacturingReportsQueryKey, branchQueryKey, segment, filters],
  });
}

export function useManufacturingSummary(filters: ManufacturingReportFilters, enabled = true) {
  return useManufacturingReportQuery<ManufacturingSummary>(
    "summary",
    filters,
    async () => getManufacturingSummary(filters),
    enabled,
  );
}

export function useProductionBatchReport(filters: ManufacturingReportFilters, enabled = true) {
  return useManufacturingReportQuery<ProductionBatchReportRow[]>(
    "batches",
    filters,
    async () => getProductionBatchReport(filters),
    enabled,
  );
}

export function useIngredientConsumptionReport(
  filters: ManufacturingReportFilters,
  enabled = true,
) {
  return useManufacturingReportQuery<IngredientConsumptionRow[]>(
    "ingredient-consumption",
    filters,
    async () => getIngredientConsumptionReport(filters),
    enabled,
  );
}

export function useYieldVarianceReport(filters: ManufacturingReportFilters, enabled = true) {
  return useManufacturingReportQuery<YieldVarianceRow[]>(
    "yield-variance",
    filters,
    async () => getYieldVarianceReport(filters),
    enabled,
  );
}

export function useManufacturingWastageReport(filters: ManufacturingReportFilters, enabled = true) {
  return useManufacturingReportQuery<ManufacturingWastageReport>(
    "wastage",
    filters,
    async () => getManufacturingWastageReport(filters),
    enabled,
  );
}

export function useRecipeCostReport(filters: ManufacturingReportFilters, enabled = true) {
  return useManufacturingReportQuery<RecipeCostReportRow[]>(
    "recipe-costs",
    filters,
    async () => getRecipeCostReport(filters),
    enabled,
  );
}

export function useManufacturingTrend(filters: ManufacturingReportFilters, enabled = true) {
  return useManufacturingReportQuery<ManufacturingTrendChart>(
    "trend",
    filters,
    async () => getManufacturingTrend(filters),
    enabled,
  );
}
