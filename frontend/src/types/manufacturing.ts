import type { BranchStatus } from "@/types/branch";
import type { ItemStructure, ProductType } from "@/types/product";

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
  productVariantId: string | null;
  productVariantName: string | null;
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
  productionDate: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBatchIngredient = {
  id: string;
  componentProductId: string | null;
  componentVariantId: string | null;
  componentProductName: string | null;
  componentVariantName: string | null;
  componentProductType: ProductType | null;
  inventoryItemId: string;
  itemName: string;
  requiredQuantity: number;
  consumedQuantity: number;
  unitName: string;
  unitSymbol: string;
  totalCost: number;
  wastagePercentage: number;
  unitCostSnapshot: number;
  stockMovementId: string | null;
  accountingJournalEntryId: string | null;
};

export type ProductionBatchPackaging = {
  id: string;
  componentProductId: string | null;
  componentVariantId: string | null;
  componentProductName: string | null;
  componentVariantName: string | null;
  componentProductType: ProductType | null;
  packagingItemId: string;
  packagingName: string;
  requiredQuantity: number;
  consumedQuantity: number;
  unitName: string;
  unitSymbol: string;
  unitCostSnapshot: number;
  totalCost: number;
  stockMovementId: string | null;
  accountingJournalEntryId: string | null;
};

export type ProductionOutput = {
  id: string;
  productId: string | null;
  productName: string | null;
  productVariantId: string | null;
  productVariantName: string | null;
  quantityProduced: number;
  unitName: string;
  unitCostSnapshot: number;
  totalCost: number;
  stockMovementId: string | null;
  accountingJournalEntryId: string | null;
  createdAt: string;
};

export type ProductionWastage = {
  id: string;
  componentProductId: string | null;
  componentVariantId: string | null;
  componentProductName: string | null;
  componentVariantName: string | null;
  componentProductType: ProductType | null;
  inventoryItemId: string;
  itemName: string;
  wastageType: string;
  quantity: number;
  unitName: string;
  reason: string;
  unitCostSnapshot: number;
  totalCost: number;
  stockMovementId: string | null;
  accountingJournalEntryId: string | null;
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
  productType: ProductType;
  itemStructure: ItemStructure;
};

export type ManufacturingRecipeOption = {
  id: string;
  recipeName: string;
  recipeCode: string;
  productVariantId: string | null;
  productVariantName: string | null;
  versionNumber: number;
  batchYieldQuantity: number;
  batchYieldUnitName: string;
  componentCount: number | null;
  packagingCount: number | null;
  isActive: boolean | null;
  status: string | null;
};

export type ProductionPreviewLineItem = {
  recipeLineId: string;
  componentProductId: string | null;
  componentVariantId: string | null;
  productName: string;
  productType: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  unitId: string;
  unit: string;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  isOptional: boolean;
};

export type ProductionPreviewShortage = {
  recipeLineId: string;
  productName: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  unit: string;
};

export type ProductionPreview = {
  recipeId: string;
  recipeName: string;
  recipeYieldQuantity: number;
  recipeYieldUnitId: string;
  recipeYieldUnit: string;
  outputProductId: string;
  outputProductName: string;
  outputProductVariantId: string | null;
  outputProductVariantName: string;
  quantityProduced: number;
  components: ProductionPreviewLineItem[];
  packaging: ProductionPreviewLineItem[];
  estimatedComponentCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  estimatedCostPerUnit: number;
  hasShortage: boolean;
  shortages: ProductionPreviewShortage[];
  hasZeroCostWarning: boolean;
  warnings: string[];
};

export type ManufacturingInventoryOption = {
  id: string;
  productId: string | null;
  productName: string | null;
  productVariantId: string | null;
  productVariantName: string | null;
  productType: ProductType | null;
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

export type CreateProductionPayload = {
  branchId: string;
  productId: string;
  productVariantId: string | null;
  productionDate: string;
  quantityProduced: number;
  recipeId: string;
  notes: string | null;
};

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
  productionDate?: string;
};

export type WastagePayload = {
  inventoryItemId: string;
  wastageType: string;
  quantity: number;
  reason: string;
};
