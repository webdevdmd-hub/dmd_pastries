import { apiRequest } from "@/lib/api/client";
import type {
  IngredientConsumptionRow,
  ManufacturingReportFilters,
  ManufacturingSummary,
  ManufacturingTrendChart,
  ManufacturingWastageReport,
  ManufacturingWastageRow,
  ProductionBatchReportRow,
  RecipeCostReportRow,
  YieldVarianceRow,
} from "@/types/manufacturing-reports";

type BackendManufacturingSummary = {
  cancelled_batches?: number;
  completed_batches?: number;
  estimated_production_cost?: number;
  total_batches?: number;
  total_planned_quantity?: number;
  total_produced_quantity?: number;
  total_wastage_quantity?: number;
  yield_efficiency_percentage?: number;
};

type BackendProductionBatchRow = {
  batch_id?: string;
  batch_number?: string;
  branch_name?: string;
  end_time?: string;
  planned_quantity?: number;
  produced_quantity?: number;
  product_name?: string;
  recipe_name?: string;
  start_time?: string;
  status?: string;
  yield_efficiency_percentage?: number;
  yield_variance?: number;
};

type BackendIngredientConsumptionRow = {
  batch_count?: number;
  branch_name?: string;
  estimated_cost?: number;
  ingredient_name?: string;
  inventory_item_id?: string;
  total_consumed_quantity?: number;
  unit_symbol?: string;
};

type BackendYieldVarianceRow = {
  batch_number?: string;
  branch_name?: string;
  planned_quantity?: number;
  produced_quantity?: number;
  product_name?: string;
  variance_percentage?: number;
  variance_quantity?: number;
};

type BackendManufacturingWastageRow = {
  batch_number?: string;
  created_at?: string;
  item_name?: string;
  quantity?: number;
  reason?: string;
  unit_symbol?: string;
  wastage_type?: string;
};

type BackendManufacturingWastageReport = {
  estimated_wastage_cost?: number;
  items?: unknown;
  total_wastage_quantity?: number;
};

type BackendRecipeCostRow = {
  batch_yield_quantity?: number;
  cost_per_yield_unit?: number;
  estimated_ingredient_cost?: number;
  estimated_packaging_cost?: number;
  estimated_total_cost?: number;
  is_active?: boolean;
  product_name?: string;
  recipe_id?: string;
  recipe_name?: string;
  version_number?: number;
};

type BackendTrend = {
  datasets?: unknown;
  labels?: unknown;
};

type BackendTrendDataset = {
  data?: unknown;
  label?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function listSource(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  const source = listSource(value);
  return Array.isArray(source) ? source.map(parser) : [];
}

function toSearchParams(filters: ManufacturingReportFilters): string {
  const params = new URLSearchParams();
  const entries: [string, number | string | undefined][] = [
    ["branch_id", filters.branchId],
    ["product_id", filters.productId],
    ["recipe_id", filters.recipeId],
    ["batch_status", filters.batchStatus],
    ["date_from", filters.dateFrom],
    ["date_to", filters.dateTo],
    ["group_by", filters.groupBy],
    ["scope", filters.scope],
    ["timezone", filters.timezone],
    ["page", filters.page],
    ["limit", filters.limit],
    ["sort_by", filters.sortBy],
    ["sort_order", filters.sortOrder],
  ];
  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parseManufacturingSummary(value: unknown): ManufacturingSummary {
  const row = isObject(value) ? (value as BackendManufacturingSummary) : {};
  return {
    cancelledBatches: numberOrZero(row.cancelled_batches),
    completedBatches: numberOrZero(row.completed_batches),
    estimatedProductionCost: numberOrZero(row.estimated_production_cost),
    totalBatches: numberOrZero(row.total_batches),
    totalPlannedQuantity: numberOrZero(row.total_planned_quantity),
    totalProducedQuantity: numberOrZero(row.total_produced_quantity),
    totalWastageQuantity: numberOrZero(row.total_wastage_quantity),
    yieldEfficiencyPercentage: numberOrZero(row.yield_efficiency_percentage),
  };
}

function parseProductionBatchRow(value: unknown): ProductionBatchReportRow {
  const row = isObject(value) ? (value as BackendProductionBatchRow) : {};
  return {
    batchId: stringOrEmpty(row.batch_id),
    batchNumber: stringOrEmpty(row.batch_number),
    branchName: stringOrEmpty(row.branch_name),
    endTime: stringOrEmpty(row.end_time),
    plannedQuantity: numberOrZero(row.planned_quantity),
    producedQuantity: numberOrZero(row.produced_quantity),
    productName: stringOrEmpty(row.product_name),
    recipeName: stringOrEmpty(row.recipe_name),
    startTime: stringOrEmpty(row.start_time),
    status: stringOrEmpty(row.status),
    yieldEfficiencyPercentage: numberOrZero(row.yield_efficiency_percentage),
    yieldVariance: numberOrZero(row.yield_variance),
  };
}

function parseIngredientConsumptionRow(value: unknown): IngredientConsumptionRow {
  const row = isObject(value) ? (value as BackendIngredientConsumptionRow) : {};
  return {
    batchCount: numberOrZero(row.batch_count),
    branchName: stringOrEmpty(row.branch_name),
    estimatedCost: numberOrZero(row.estimated_cost),
    ingredientName: stringOrEmpty(row.ingredient_name),
    inventoryItemId: stringOrEmpty(row.inventory_item_id),
    totalConsumedQuantity: numberOrZero(row.total_consumed_quantity),
    unitSymbol: stringOrEmpty(row.unit_symbol),
  };
}

function parseYieldVarianceRow(value: unknown): YieldVarianceRow {
  const row = isObject(value) ? (value as BackendYieldVarianceRow) : {};
  return {
    batchNumber: stringOrEmpty(row.batch_number),
    branchName: stringOrEmpty(row.branch_name),
    plannedQuantity: numberOrZero(row.planned_quantity),
    producedQuantity: numberOrZero(row.produced_quantity),
    productName: stringOrEmpty(row.product_name),
    variancePercentage: numberOrZero(row.variance_percentage),
    varianceQuantity: numberOrZero(row.variance_quantity),
  };
}

function parseManufacturingWastageRow(value: unknown): ManufacturingWastageRow {
  const row = isObject(value) ? (value as BackendManufacturingWastageRow) : {};
  return {
    batchNumber: stringOrEmpty(row.batch_number),
    createdAt: stringOrEmpty(row.created_at),
    itemName: stringOrEmpty(row.item_name),
    quantity: numberOrZero(row.quantity),
    reason: stringOrEmpty(row.reason),
    unitSymbol: stringOrEmpty(row.unit_symbol),
    wastageType: stringOrEmpty(row.wastage_type),
  };
}

function parseManufacturingWastageReport(value: unknown): ManufacturingWastageReport {
  const row = isObject(value) ? (value as BackendManufacturingWastageReport) : {};
  return {
    estimatedWastageCost: numberOrZero(row.estimated_wastage_cost),
    items: parseList(row.items, parseManufacturingWastageRow),
    totalWastageQuantity: numberOrZero(row.total_wastage_quantity),
  };
}

function parseRecipeCostRow(value: unknown): RecipeCostReportRow {
  const row = isObject(value) ? (value as BackendRecipeCostRow) : {};
  return {
    batchYieldQuantity: numberOrZero(row.batch_yield_quantity),
    costPerYieldUnit: numberOrZero(row.cost_per_yield_unit),
    estimatedIngredientCost: numberOrZero(row.estimated_ingredient_cost),
    estimatedPackagingCost: numberOrZero(row.estimated_packaging_cost),
    estimatedTotalCost: numberOrZero(row.estimated_total_cost),
    isActive: booleanOrFalse(row.is_active),
    productName: stringOrEmpty(row.product_name),
    recipeId: stringOrEmpty(row.recipe_id),
    recipeName: stringOrEmpty(row.recipe_name),
    versionNumber: numberOrZero(row.version_number),
  };
}

function parseManufacturingTrend(value: unknown): ManufacturingTrendChart {
  const chart = isObject(value) ? (value as BackendTrend) : {};
  const labels = Array.isArray(chart.labels)
    ? chart.labels.filter((label): label is string => typeof label === "string")
    : [];
  const datasets = Array.isArray(chart.datasets)
    ? chart.datasets.filter(isObject).map((dataset) => {
        const typedDataset = dataset as BackendTrendDataset;
        return {
          data: Array.isArray(typedDataset.data)
            ? typedDataset.data.filter((item): item is number => typeof item === "number")
            : [],
          label: stringOrEmpty(typedDataset.label),
        };
      })
    : [];
  return { datasets, labels };
}

async function getReport<TResponse>(
  path: string,
  filters: ManufacturingReportFilters,
  parse: (value: unknown) => TResponse,
): Promise<TResponse> {
  const response = await apiRequest<TResponse>(`${path}${toSearchParams(filters)}`, {
    authMode: "appwrite",
    parse,
  });
  return response.data;
}

export async function getManufacturingSummary(
  filters: ManufacturingReportFilters,
): Promise<ManufacturingSummary> {
  return getReport("/api/v1/reports/manufacturing/summary", filters, parseManufacturingSummary);
}

export async function getProductionBatchReport(
  filters: ManufacturingReportFilters,
): Promise<ProductionBatchReportRow[]> {
  return getReport("/api/v1/reports/manufacturing/batches", filters, (value) =>
    parseList(value, parseProductionBatchRow),
  );
}

export async function getIngredientConsumptionReport(
  filters: ManufacturingReportFilters,
): Promise<IngredientConsumptionRow[]> {
  return getReport("/api/v1/reports/manufacturing/ingredient-consumption", filters, (value) =>
    parseList(value, parseIngredientConsumptionRow),
  );
}

export async function getYieldVarianceReport(
  filters: ManufacturingReportFilters,
): Promise<YieldVarianceRow[]> {
  return getReport("/api/v1/reports/manufacturing/yield-variance", filters, (value) =>
    parseList(value, parseYieldVarianceRow),
  );
}

export async function getManufacturingWastageReport(
  filters: ManufacturingReportFilters,
): Promise<ManufacturingWastageReport> {
  return getReport(
    "/api/v1/reports/manufacturing/wastage",
    filters,
    parseManufacturingWastageReport,
  );
}

export async function getRecipeCostReport(
  filters: ManufacturingReportFilters,
): Promise<RecipeCostReportRow[]> {
  return getReport("/api/v1/reports/manufacturing/recipe-costs", filters, (value) =>
    parseList(value, parseRecipeCostRow),
  );
}

export async function getManufacturingTrend(
  filters: ManufacturingReportFilters,
): Promise<ManufacturingTrendChart> {
  return getReport("/api/v1/reports/manufacturing/trend", filters, parseManufacturingTrend);
}
