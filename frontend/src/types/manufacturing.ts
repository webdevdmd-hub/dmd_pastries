import type { BranchStatus } from "@/types/branch";

export type BatchStatus =
  | "draft"
  | "in_progress"
  | "partially_completed"
  | "completed"
  | "cancelled";

export type ProductionBatch = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  recipeId: string;
  recipeName: string;
  recipeVersionNumber: number;
  batchNumber: string;
  plannedQuantity: number;
  producedQuantity: number;
  wastageQuantity: number;
  batchUnitId: string;
  batchUnitName: string;
  status: BatchStatus;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBatchIngredient = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  requiredQuantity: number;
  consumedQuantity: number;
  unitName: string;
  unitSymbol: string;
  totalCost: number;
  wastagePercentage: number;
};

export type ProductionBatchPackaging = {
  id: string;
  packagingItemId: string;
  packagingName: string;
  requiredQuantity: number;
  consumedQuantity: number;
  unitName: string;
  unitSymbol: string;
};

export type ProductionOutput = {
  id: string;
  quantityProduced: number;
  unitName: string;
  createdAt: string;
};

export type ProductionWastage = {
  id: string;
  itemName: string;
  wastageType: string;
  quantity: number;
  unitName: string;
  reason: string;
  createdAt: string;
};

export type ManufacturingSummary = {
  totalBatches: number;
  inProgressBatches: number;
  completedBatches: number;
  totalProductionOutput: number;
};

export type ManufacturingProductOption = {
  id: string;
  productName: string;
  productCode: string;
};

export type ManufacturingRecipeOption = {
  id: string;
  recipeName: string;
  recipeCode: string;
  versionNumber: number;
  batchYieldQuantity: number;
  batchYieldUnitName: string;
  isActive: boolean | null;
  status: string | null;
};

export type ManufacturingInventoryOption = {
  id: string;
  itemName: string;
  itemCode: string;
  unitName: string;
  unitSymbol: string;
};

export type ManufacturingUnitOption = {
  id: string;
  unitName: string;
  symbol: string;
};

export type ManufacturingBranchOption = {
  id: string;
  branchName: string;
  status: BranchStatus;
};

export type BatchFilters = {
  search: string;
  productId: string;
  branchId: string;
  status: BatchStatus | "all";
  dateFrom: string;
  dateTo: string;
};

export type CreateBatchPayload = {
  branchId: string;
  productId: string;
  productionDate: string;
  recipeId: string;
  plannedQuantity: number;
  notes: string | null;
};

export type UpdateBatchPayload = Partial<CreateBatchPayload>;

export type UpdateBatchStatusPayload = {
  status: BatchStatus;
};

export type ConsumePayload = {
  lines: {
    batchIngredientId: string;
    consumedQuantity: number;
  }[];
};

export type ProducePayload = {
  quantityProduced: number;
};

export type WastagePayload = {
  inventoryItemId: string;
  wastageType: string;
  quantity: number;
  reason: string;
};
