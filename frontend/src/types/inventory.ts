export type InventoryItemType = "product" | "ingredient" | "packaging";

export type InventoryStatus = "active" | "inactive";

export type MovementType =
  | "opening_stock"
  | "purchase_in"
  | "sale_out"
  | "adjustment_in"
  | "adjustment_out"
  | "wastage"
  | "return_in"
  | "transfer_in"
  | "transfer_out"
  | "production_in"
  | "production_out";

export type AdjustmentType = "increase" | "decrease";

export type ExpiryBatchStatus = "active" | "expired" | "depleted";

export type InventoryItem = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  productId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  itemType: InventoryItemType;
  itemName: string;
  itemCode: string;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  isExpiryTracked: boolean;
  lowStock: boolean;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  inventoryItemId: string;
  itemType: InventoryItemType;
  itemName: string;
  movementType: MovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitId: string;
  unitSymbol: string;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdByUserName: string;
  createdAt: string;
};

export type ExpiryBatch = {
  id: string;
  businessId: string;
  branchId: string;
  inventoryItemId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  receivedDate: string;
  status: ExpiryBatchStatus;
  createdAt: string;
  updatedAt: string;
};

export type OpeningStockPayload = {
  branchId: string;
  itemType: InventoryItemType;
  productId?: string;
  ingredientId?: string;
  packagingItemId?: string;
  unitId: string;
  quantity: number;
  reorderLevel: number;
  isExpiryTracked: boolean;
  expiryDate?: string;
  reason?: string;
};

export type StockAdjustmentPayload = {
  adjustmentType: AdjustmentType;
  quantity: number;
  reason: string;
};

export type CreateExpiryBatchPayload = {
  batchNumber?: string;
  quantity: number;
  receivedDate: string;
  expiryDate: string;
};

export type UpdateExpiryBatchPayload = Partial<CreateExpiryBatchPayload>;

export type UpdateExpiryBatchStatusPayload = {
  status: ExpiryBatchStatus;
};

export type InventoryFilters = {
  search: string;
  branchId: string;
  itemType: InventoryItemType | "all";
  status: InventoryStatus | "all";
  lowStockOnly: boolean;
  expiryTrackedOnly: boolean;
};

export type StockMovementFilters = {
  search: string;
  branchId: string;
  itemType: InventoryItemType | "all";
  movementType: MovementType | "all";
  dateFrom: string;
  dateTo: string;
};

export type LowStockFilters = {
  search: string;
  branchId: string;
  itemType: InventoryItemType | "all";
};

export type ExpiryAlertFilters = {
  branchId: string;
  itemType: InventoryItemType | "all";
  status: ExpiryBatchStatus | "all";
  days: number;
};
