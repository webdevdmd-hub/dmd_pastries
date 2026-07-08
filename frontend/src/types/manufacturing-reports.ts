export type ManufacturingReportGroupBy = "day" | "week" | "month";
export type ManufacturingReportSortOrder = "asc" | "desc";

export type ManufacturingReportFilters = {
  batchStatus?: string;
  branchId?: string;
  dateFrom: string;
  dateTo: string;
  groupBy?: ManufacturingReportGroupBy;
  limit?: number;
  page?: number;
  productId?: string;
  recipeId?: string;
  scope?: "all_branches" | "current_branch";
  sortBy?: string;
  sortOrder?: ManufacturingReportSortOrder;
  timezone?: string;
};

export type ManufacturingSummary = {
  cancelledBatches: number;
  completedBatches: number;
  estimatedProductionCost: number;
  totalBatches: number;
  totalPlannedQuantity: number;
  totalProducedQuantity: number;
  totalWastageQuantity: number;
  yieldEfficiencyPercentage: number;
};

export type ProductionBatchReportRow = {
  batchId: string;
  batchNumber: string;
  branchName: string;
  endTime: string;
  plannedQuantity: number;
  producedQuantity: number;
  productName: string;
  recipeName: string;
  startTime: string;
  status: string;
  yieldEfficiencyPercentage: number;
  yieldVariance: number;
};

export type IngredientConsumptionRow = {
  batchCount: number;
  branchName: string;
  estimatedCost: number;
  ingredientName: string;
  inventoryItemId: string;
  totalConsumedQuantity: number;
  unitSymbol: string;
};

export type YieldVarianceRow = {
  batchNumber: string;
  branchName: string;
  plannedQuantity: number;
  producedQuantity: number;
  productName: string;
  variancePercentage: number;
  varianceQuantity: number;
};

export type ManufacturingWastageRow = {
  batchNumber: string;
  createdAt: string;
  itemName: string;
  quantity: number;
  reason: string;
  unitSymbol: string;
  wastageType: string;
};

export type ManufacturingWastageReport = {
  estimatedWastageCost: number;
  items: ManufacturingWastageRow[];
  totalWastageQuantity: number;
};

export type RecipeCostReportRow = {
  batchYieldQuantity: number;
  costPerYieldUnit: number;
  estimatedIngredientCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  isActive: boolean;
  productName: string;
  recipeId: string;
  recipeName: string;
  versionNumber: number;
};

export type ManufacturingTrendDataset = {
  data: number[];
  label: string;
};

export type ManufacturingTrendChart = {
  datasets: ManufacturingTrendDataset[];
  labels: string[];
};
