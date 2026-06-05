export type InventoryItemType = "product" | "product_variant" | "ingredient" | "packaging";

export type InventoryStatus = "active" | "inactive";
export type InventoryRecordStatus = InventoryStatus | "not_initialized";

export type StockLocationType =
  | "kitchen"
  | "store_room"
  | "front_desk"
  | "display_counter"
  | "warehouse"
  | "production_area"
  | "pickup_area"
  | "other";

export type StockTransferStatus = "draft" | "completed" | "cancelled";

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
  productVariantId: string | null;
  variantName: string | null;
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
  status: InventoryRecordStatus;
  canAddOpeningStock: boolean;
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
  stockLocationId: string | null;
  stockLocationName: string | null;
  fromStockLocationId: string | null;
  fromStockLocationName: string | null;
  toStockLocationId: string | null;
  toStockLocationName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  unitCostSnapshot: number;
  totalCost: number;
  valuationMethod: string | null;
  accountingJournalEntryId: string | null;
  createdByUserName: string;
  createdAt: string;
};

export type ExpiryBatch = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string | null;
  inventoryItemId: string;
  itemType: InventoryItemType | null;
  itemName: string | null;
  itemCode: string | null;
  batchNumber: string;
  quantity: number;
  unitSymbol: string | null;
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
  productVariantId?: string;
  ingredientId?: string;
  packagingItemId?: string;
  unitId: string;
  stockLocationId?: string;
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

export type StockLocation = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  locationName: string;
  locationCode: string;
  locationType: StockLocationType;
  description: string | null;
  isDefault: boolean;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type StockLocationPayload = {
  locationName: string;
  locationCode: string;
  locationType: StockLocationType;
  description?: string;
  isDefault: boolean;
  status: InventoryStatus;
};

export type LocationBalance = {
  inventoryItemId: string;
  branchId: string;
  branchName: string;
  itemType: InventoryItemType;
  productId: string | null;
  productVariantId: string | null;
  variantName: string | null;
  itemName: string;
  itemCode: string;
  stockLocationId: string;
  stockLocationName: string;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unit: {
    id: string;
    unitName: string;
    symbol: string;
  };
};

export type InventoryItemLocationBreakdown = {
  inventoryItemId: string;
  itemName: string;
  itemType: InventoryItemType;
  branchId: string;
  branchName: string;
  branchTotalQuantity: number;
  locations: {
    stockLocationId: string;
    stockLocationName: string;
    currentQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  }[];
};

export type StockTransfer = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  inventoryItemId: string;
  itemType: InventoryItemType;
  itemName: string;
  fromStockLocationId: string;
  fromStockLocationName: string;
  toStockLocationId: string;
  toStockLocationName: string;
  quantity: number;
  reason: string;
  notes: string | null;
  status: StockTransferStatus;
  createdByUserName: string;
  completedByUserName: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StockTransferPayload = {
  inventoryItemId: string;
  fromStockLocationId: string;
  toStockLocationId: string;
  quantity: number;
  reason: string;
  notes?: string;
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
  includeUninitialized: boolean;
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

export type LocationBalanceFilters = {
  search: string;
  itemType: InventoryItemType | "all";
  stockLocationId: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

export type StockTransferFilters = {
  search: string;
  status: StockTransferStatus | "all";
  itemType: InventoryItemType | "all";
  stockLocationId: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
};
