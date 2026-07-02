import { apiRequest } from "@/lib/api/client";
import type {
  CreateExpiryBatchPayload,
  ExpiryAlertFilters,
  ExpiryBatch,
  ExpiryBatchStatus,
  InventoryFilters,
  InventoryItem,
  InventoryItemLocationBreakdown,
  InventoryItemType,
  InventoryStatus,
  LocationBalance,
  LocationBalanceFilters,
  LowStockFilters,
  MovementType,
  OpeningStockPayload,
  StockAdjustmentPayload,
  StockLocation,
  StockLocationPayload,
  StockLocationType,
  StockMovement,
  StockMovementFilters,
  StockTransfer,
  StockTransferFilters,
  StockTransferPayload,
  StockTransferStatus,
  UpdateExpiryBatchPayload,
  UpdateExpiryBatchStatusPayload,
} from "@/types/inventory";
import { PRODUCT_TYPES, type ProductType } from "@/types/product";

type BackendOpeningStockPayload = {
  branch_id: string;
  item_type: OpeningStockPayload["itemType"];
  product_id?: string;
  product_variant_id?: string;
  unit_id: string;
  stock_location_id?: string;
  quantity: number;
  unit_cost: number;
  reorder_level: number;
  is_expiry_tracked: boolean;
  expiry_date?: string;
  reason?: string;
};

type BackendStockAdjustmentPayload = {
  adjustment_type: StockAdjustmentPayload["adjustmentType"];
  quantity: number;
  reason: string;
};

type BackendExpiryBatchPayload = {
  batch_number?: string;
  quantity?: number;
  received_date?: string;
  expiry_date?: string;
};

type BackendStockLocationPayload = {
  location_name: string;
  location_code: string;
  location_type: StockLocationType;
  description?: string;
  is_default: boolean;
  status: InventoryStatus;
};

type BackendStockTransferPayload = {
  inventory_item_id: string;
  from_stock_location_id: string;
  to_stock_location_id: string;
  quantity: number;
  reason: string;
  notes?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isInventoryItemType(value: unknown): value is InventoryItemType {
  return (
    value === "product" ||
    value === "product_variant" ||
    value === "ingredient" ||
    value === "packaging"
  );
}

function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.includes(value as ProductType);
}

function isInventoryStatus(value: unknown): value is InventoryStatus {
  return value === "active" || value === "inactive";
}

function inventoryRecordStatus(value: unknown): InventoryItem["status"] {
  if (value === "not_initialized") {
    return "not_initialized";
  }

  return isInventoryStatus(value) ? value : "active";
}

function isStockLocationType(value: unknown): value is StockLocationType {
  return (
    value === "kitchen" ||
    value === "store_room" ||
    value === "front_desk" ||
    value === "display_counter" ||
    value === "warehouse" ||
    value === "production_area" ||
    value === "pickup_area" ||
    value === "other"
  );
}

function isStockTransferStatus(value: unknown): value is StockTransferStatus {
  return value === "draft" || value === "completed" || value === "cancelled";
}

function isMovementType(value: unknown): value is MovementType {
  return (
    value === "opening_stock" ||
    value === "purchase_in" ||
    value === "sale_out" ||
    value === "adjustment_in" ||
    value === "adjustment_out" ||
    value === "wastage" ||
    value === "return_in" ||
    value === "transfer_in" ||
    value === "transfer_out" ||
    value === "production_in" ||
    value === "production_out"
  );
}

function isExpiryBatchStatus(value: unknown): value is ExpiryBatchStatus {
  return value === "active" || value === "expired" || value === "depleted";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parser);
  }

  if (isObject(value) && Array.isArray(value.data)) {
    return value.data.map(parser);
  }

  return [];
}

function parseInventoryItem(value: unknown): InventoryItem {
  if (!isObject(value)) {
    throw new Error("Backend inventory item payload is invalid.");
  }

  const unit = isObject(value.unit) ? value.unit : {};

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    productId: nullableString(value.product_id),
    productVariantId: nullableString(value.product_variant_id),
    variantName: nullableString(value.variant_name),
    productType: isProductType(value.product_type) ? value.product_type : null,
    ingredientId: nullableString(value.ingredient_id),
    packagingItemId: nullableString(value.packaging_item_id),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    itemName: stringValue(value.item_name, "Inventory item"),
    itemCode: stringValue(value.sku, stringValue(value.item_code, stringValue(value.barcode))),
    currentQuantity: numberValue(value.current_quantity),
    reservedQuantity: numberValue(value.reserved_quantity),
    availableQuantity: numberValue(value.available_quantity),
    reorderLevel: numberValue(value.reorder_level),
    averageCost: numberValue(value.average_unit_cost ?? value.average_cost ?? value.avg_cost),
    inventoryValue: numberValue(
      value.inventory_value ?? value.total_value ?? value.stock_value ?? value.current_value,
    ),
    unitId: stringValue(value.unit_id, stringValue(unit.id)),
    unitName: stringValue(value.unit_name, stringValue(unit.unit_name, "Unit")),
    unitSymbol: stringValue(value.unit_symbol, stringValue(unit.symbol)),
    isExpiryTracked: booleanValue(value.is_expiry_tracked),
    lowStock: booleanValue(value.low_stock),
    status: inventoryRecordStatus(value.inventory_status ?? value.status),
    canAddOpeningStock: booleanValue(value.can_add_opening_stock),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseStockMovement(value: unknown): StockMovement {
  if (!isObject(value)) {
    throw new Error("Backend stock movement payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    inventoryItemId: stringValue(value.inventory_item_id),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    itemName: stringValue(value.item_name, "Inventory item"),
    movementType: isMovementType(value.movement_type) ? value.movement_type : "adjustment_in",
    quantity: numberValue(value.quantity),
    beforeQuantity: numberValue(value.before_quantity),
    afterQuantity: numberValue(value.after_quantity),
    unitId: stringValue(value.unit_id),
    unitSymbol: stringValue(value.unit_symbol),
    stockLocationId: nullableString(value.stock_location_id),
    stockLocationName: nullableString(value.stock_location_name),
    fromStockLocationId: nullableString(value.from_stock_location_id),
    fromStockLocationName: nullableString(value.from_stock_location_name),
    toStockLocationId: nullableString(value.to_stock_location_id),
    toStockLocationName: nullableString(value.to_stock_location_name),
    referenceType: nullableString(value.reference_type),
    referenceId: nullableString(value.reference_id),
    reason: nullableString(value.reason),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    valuationMethod: nullableString(value.valuation_method),
    accountingJournalEntryId: nullableString(value.accounting_journal_entry_id),
    createdByUserName: stringValue(value.created_by_user_name, "System"),
    createdAt: stringValue(value.created_at),
  };
}

function parseExpiryBatch(value: unknown): ExpiryBatch {
  if (!isObject(value)) {
    throw new Error("Backend expiry batch payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: nullableString(value.branch_name),
    inventoryItemId: stringValue(value.inventory_item_id),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : null,
    itemName: nullableString(value.item_name),
    itemCode: nullableString(value.item_code),
    batchNumber: stringValue(value.batch_number, "Batch"),
    quantity: numberValue(value.quantity),
    unitSymbol: nullableString(value.unit_symbol),
    expiryDate: stringValue(value.expiry_date),
    receivedDate: stringValue(value.received_date),
    status: isExpiryBatchStatus(value.status) ? value.status : "active",
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseStockLocation(value: unknown): StockLocation {
  if (!isObject(value)) {
    throw new Error("Backend stock location payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Current branch"),
    locationName: stringValue(value.location_name, "Stock location"),
    locationCode: stringValue(value.location_code),
    locationType: isStockLocationType(value.location_type) ? value.location_type : "other",
    description: nullableString(value.description),
    isDefault: booleanValue(value.is_default),
    status: isInventoryStatus(value.status) ? value.status : "active",
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseLocationBalance(value: unknown): LocationBalance {
  if (!isObject(value)) {
    throw new Error("Backend location balance payload is invalid.");
  }

  const unit = isObject(value.unit) ? value.unit : {};

  return {
    inventoryItemId: stringValue(value.inventory_item_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    productId: nullableString(value.product_id),
    productVariantId: nullableString(value.product_variant_id),
    variantName: nullableString(value.variant_name),
    itemName: stringValue(value.item_name, "Inventory item"),
    itemCode: stringValue(value.item_code),
    stockLocationId: stringValue(value.stock_location_id),
    stockLocationName: stringValue(value.stock_location_name, "Stock location"),
    currentQuantity: numberValue(value.current_quantity),
    reservedQuantity: numberValue(value.reserved_quantity),
    availableQuantity: numberValue(value.available_quantity),
    unit: {
      id: stringValue(unit.id),
      unitName: stringValue(unit.unit_name, "Unit"),
      symbol: stringValue(unit.symbol),
    },
  };
}

function parseInventoryItemLocationBreakdown(value: unknown): InventoryItemLocationBreakdown {
  if (!isObject(value)) {
    throw new Error("Backend item location balance payload is invalid.");
  }

  const locations = Array.isArray(value.locations)
    ? value.locations.map((location) => {
        if (!isObject(location)) {
          return {
            stockLocationId: "",
            stockLocationName: "Stock location",
            currentQuantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
          };
        }

        return {
          stockLocationId: stringValue(location.stock_location_id),
          stockLocationName: stringValue(location.stock_location_name, "Stock location"),
          currentQuantity: numberValue(location.current_quantity),
          reservedQuantity: numberValue(location.reserved_quantity),
          availableQuantity: numberValue(location.available_quantity),
        };
      })
    : [];

  return {
    inventoryItemId: stringValue(value.inventory_item_id),
    itemName: stringValue(value.item_name, "Inventory item"),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    branchTotalQuantity: numberValue(value.branch_total_quantity),
    locations,
  };
}

function parseStockTransfer(value: unknown): StockTransfer {
  if (!isObject(value)) {
    throw new Error("Backend stock transfer payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    inventoryItemId: stringValue(value.inventory_item_id),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    itemName: stringValue(value.item_name, "Inventory item"),
    fromStockLocationId: stringValue(value.from_stock_location_id),
    fromStockLocationName: stringValue(value.from_stock_location_name, "Source"),
    toStockLocationId: stringValue(value.to_stock_location_id),
    toStockLocationName: stringValue(value.to_stock_location_name, "Target"),
    quantity: numberValue(value.quantity),
    reason: stringValue(value.reason),
    notes: nullableString(value.notes),
    status: isStockTransferStatus(value.status) ? value.status : "draft",
    createdByUserName: stringValue(value.created_by_user_name, "System"),
    completedByUserName: nullableString(value.completed_by_user_name),
    completedAt: nullableString(value.completed_at),
    cancelledAt: nullableString(value.cancelled_at),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all" && value !== false) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function openingStockPayload(payload: OpeningStockPayload): BackendOpeningStockPayload {
  return {
    branch_id: payload.branchId,
    item_type: payload.itemType,
    ...(payload.productId ? { product_id: payload.productId } : {}),
    ...(payload.productVariantId ? { product_variant_id: payload.productVariantId } : {}),
    unit_id: payload.unitId,
    ...(payload.stockLocationId ? { stock_location_id: payload.stockLocationId } : {}),
    quantity: payload.quantity,
    unit_cost: payload.unitCost,
    reorder_level: payload.reorderLevel,
    is_expiry_tracked: payload.isExpiryTracked,
    ...(payload.expiryDate ? { expiry_date: payload.expiryDate } : {}),
    ...(payload.reason ? { reason: payload.reason } : {}),
  };
}

function expiryBatchPayload(
  payload: CreateExpiryBatchPayload | UpdateExpiryBatchPayload,
): BackendExpiryBatchPayload {
  return {
    ...(payload.batchNumber !== undefined ? { batch_number: payload.batchNumber } : {}),
    ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
    ...(payload.receivedDate !== undefined ? { received_date: payload.receivedDate } : {}),
    ...(payload.expiryDate !== undefined ? { expiry_date: payload.expiryDate } : {}),
  };
}

function stockLocationPayload(payload: StockLocationPayload): BackendStockLocationPayload {
  return {
    location_name: payload.locationName,
    location_code: payload.locationCode,
    location_type: payload.locationType,
    ...(payload.description ? { description: payload.description } : {}),
    is_default: payload.isDefault,
    status: payload.status,
  };
}

function stockTransferPayload(payload: StockTransferPayload): BackendStockTransferPayload {
  return {
    inventory_item_id: payload.inventoryItemId,
    from_stock_location_id: payload.fromStockLocationId,
    to_stock_location_id: payload.toStockLocationId,
    quantity: payload.quantity,
    reason: payload.reason,
    ...(payload.notes ? { notes: payload.notes } : {}),
  };
}

export async function getInventory(params: InventoryFilters): Promise<InventoryItem[]> {
  const response = await apiRequest<InventoryItem[]>(
    `/api/v1/inventory${queryString({
      search: params.search,
      branch_id: params.branchId,
      item_type: params.itemType,
      product_type: params.productType,
      status: params.status,
      low_stock: params.lowStockOnly,
      expiry_tracked: params.expiryTrackedOnly,
      include_uninitialized: params.includeUninitialized,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseInventoryItem),
    },
  );

  return response.data;
}

export async function getInventoryById(id: string): Promise<InventoryItem> {
  const response = await apiRequest<InventoryItem>(`/api/v1/inventory/${id}`, {
    authMode: "appwrite",
    parse: parseInventoryItem,
  });

  return response.data;
}

export async function createOpeningStock(payload: OpeningStockPayload): Promise<InventoryItem> {
  const response = await apiRequest<InventoryItem, BackendOpeningStockPayload>(
    "/api/v1/inventory/opening-stock",
    {
      method: "POST",
      authMode: "appwrite",
      body: openingStockPayload(payload),
      parse: parseInventoryItem,
    },
  );

  return response.data;
}

export async function adjustStock(
  id: string,
  payload: StockAdjustmentPayload,
): Promise<InventoryItem> {
  const response = await apiRequest<InventoryItem, BackendStockAdjustmentPayload>(
    `/api/v1/inventory/${id}/adjust`,
    {
      method: "POST",
      authMode: "appwrite",
      body: {
        adjustment_type: payload.adjustmentType,
        quantity: payload.quantity,
        reason: payload.reason,
      },
      parse: parseInventoryItem,
    },
  );

  return response.data;
}

export async function getInventoryMovements(
  params: StockMovementFilters,
): Promise<StockMovement[]> {
  const response = await apiRequest<StockMovement[]>(
    `/api/v1/inventory/movements${queryString({
      search: params.search,
      branch_id: params.branchId,
      item_type: params.itemType,
      product_type: params.productType,
      movement_type: params.movementType,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseStockMovement),
    },
  );

  return response.data;
}

export async function getInventoryItemMovements(
  id: string,
  params: Partial<StockMovementFilters>,
): Promise<StockMovement[]> {
  const response = await apiRequest<StockMovement[]>(
    `/api/v1/inventory/${id}/movements${queryString({
      movement_type: params.movementType,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseStockMovement),
    },
  );

  return response.data;
}

export async function getLowStock(params: LowStockFilters): Promise<InventoryItem[]> {
  const response = await apiRequest<InventoryItem[]>(
    `/api/v1/inventory/low-stock${queryString({
      search: params.search,
      branch_id: params.branchId,
      item_type: params.itemType,
      product_type: params.productType,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseInventoryItem),
    },
  );

  return response.data;
}

export async function getExpiryAlerts(params: ExpiryAlertFilters): Promise<ExpiryBatch[]> {
  const response = await apiRequest<ExpiryBatch[]>(
    `/api/v1/inventory/expiry-alerts${queryString({
      branch_id: params.branchId,
      item_type: params.itemType,
      product_type: params.productType,
      status: params.status,
      days: params.days,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseExpiryBatch),
    },
  );

  return response.data;
}

export async function getExpiryBatches(inventoryItemId: string): Promise<ExpiryBatch[]> {
  const response = await apiRequest<ExpiryBatch[]>(
    `/api/v1/inventory/${inventoryItemId}/expiry-batches`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseExpiryBatch),
    },
  );

  return response.data;
}

export async function createExpiryBatch(
  inventoryItemId: string,
  payload: CreateExpiryBatchPayload,
): Promise<ExpiryBatch> {
  const response = await apiRequest<ExpiryBatch, BackendExpiryBatchPayload>(
    `/api/v1/inventory/${inventoryItemId}/expiry-batches`,
    {
      method: "POST",
      authMode: "appwrite",
      body: expiryBatchPayload(payload),
      parse: parseExpiryBatch,
    },
  );

  return response.data;
}

export async function updateExpiryBatch(
  batchId: string,
  payload: UpdateExpiryBatchPayload,
): Promise<ExpiryBatch> {
  const response = await apiRequest<ExpiryBatch, BackendExpiryBatchPayload>(
    `/api/v1/inventory/expiry-batches/${batchId}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: expiryBatchPayload(payload),
      parse: parseExpiryBatch,
    },
  );

  return response.data;
}

export async function updateExpiryBatchStatus(
  batchId: string,
  payload: UpdateExpiryBatchStatusPayload,
): Promise<ExpiryBatch> {
  const response = await apiRequest<ExpiryBatch, UpdateExpiryBatchStatusPayload>(
    `/api/v1/inventory/expiry-batches/${batchId}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseExpiryBatch,
    },
  );

  return response.data;
}

export async function getStockLocations(): Promise<StockLocation[]> {
  const response = await apiRequest<StockLocation[]>("/api/v1/inventory/stock-locations", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseStockLocation),
  });

  return response.data;
}

export async function getStockLocationById(locationId: string): Promise<StockLocation> {
  const response = await apiRequest<StockLocation>(
    `/api/v1/inventory/stock-locations/${locationId}`,
    {
      authMode: "appwrite",
      parse: parseStockLocation,
    },
  );

  return response.data;
}

export async function createStockLocation(payload: StockLocationPayload): Promise<StockLocation> {
  const response = await apiRequest<StockLocation, BackendStockLocationPayload>(
    "/api/v1/inventory/stock-locations",
    {
      method: "POST",
      authMode: "appwrite",
      body: stockLocationPayload(payload),
      parse: parseStockLocation,
    },
  );

  return response.data;
}

export async function updateStockLocation(
  locationId: string,
  payload: StockLocationPayload,
): Promise<StockLocation> {
  const response = await apiRequest<StockLocation, BackendStockLocationPayload>(
    `/api/v1/inventory/stock-locations/${locationId}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: stockLocationPayload(payload),
      parse: parseStockLocation,
    },
  );

  return response.data;
}

export async function updateStockLocationStatus(
  locationId: string,
  status: InventoryStatus,
): Promise<StockLocation> {
  const response = await apiRequest<StockLocation, { status: InventoryStatus }>(
    `/api/v1/inventory/stock-locations/${locationId}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: { status },
      parse: parseStockLocation,
    },
  );

  return response.data;
}

export async function setDefaultStockLocation(locationId: string): Promise<StockLocation> {
  const response = await apiRequest<StockLocation>(
    `/api/v1/inventory/stock-locations/${locationId}/default`,
    {
      method: "PATCH",
      authMode: "appwrite",
      parse: parseStockLocation,
    },
  );

  return response.data;
}

export async function deleteStockLocation(locationId: string): Promise<void> {
  await apiRequest<unknown>(`/api/v1/inventory/stock-locations/${locationId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: (data) => data,
  });
}

export async function getLocationBalances(
  filters: LocationBalanceFilters,
): Promise<LocationBalance[]> {
  const response = await apiRequest<LocationBalance[]>(
    `/api/v1/inventory/location-balances${queryString({
      search: filters.search,
      item_type: filters.itemType,
      product_type: filters.productType,
      stock_location_id: filters.stockLocationId,
      page: filters.page,
      limit: filters.limit,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseLocationBalance),
    },
  );

  return response.data;
}

export async function getInventoryItemLocationBalances(
  inventoryItemId: string,
): Promise<InventoryItemLocationBreakdown> {
  const response = await apiRequest<InventoryItemLocationBreakdown>(
    `/api/v1/inventory/${inventoryItemId}/location-balances`,
    {
      authMode: "appwrite",
      parse: parseInventoryItemLocationBreakdown,
    },
  );

  return response.data;
}

export async function getStockTransfers(filters: StockTransferFilters): Promise<StockTransfer[]> {
  const response = await apiRequest<StockTransfer[]>(
    `/api/v1/inventory/stock-transfers${queryString({
      search: filters.search,
      status: filters.status,
      item_type: filters.itemType,
      product_type: filters.productType,
      stock_location_id: filters.stockLocationId,
      page: filters.page,
      limit: filters.limit,
      sort_by: filters.sortBy,
      sort_order: filters.sortOrder,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseStockTransfer),
    },
  );

  return response.data;
}

export async function getStockTransferById(transferId: string): Promise<StockTransfer> {
  const response = await apiRequest<StockTransfer>(
    `/api/v1/inventory/stock-transfers/${transferId}`,
    {
      authMode: "appwrite",
      parse: parseStockTransfer,
    },
  );

  return response.data;
}

export async function createStockTransfer(payload: StockTransferPayload): Promise<StockTransfer> {
  const response = await apiRequest<StockTransfer, BackendStockTransferPayload>(
    "/api/v1/inventory/stock-transfers",
    {
      method: "POST",
      authMode: "appwrite",
      body: stockTransferPayload(payload),
      parse: parseStockTransfer,
    },
  );

  return response.data;
}

export async function completeStockTransfer(transferId: string): Promise<StockTransfer> {
  const response = await apiRequest<StockTransfer>(
    `/api/v1/inventory/stock-transfers/${transferId}/complete`,
    {
      method: "POST",
      authMode: "appwrite",
      parse: parseStockTransfer,
    },
  );

  return response.data;
}

export async function cancelStockTransfer(transferId: string): Promise<StockTransfer> {
  const response = await apiRequest<StockTransfer>(
    `/api/v1/inventory/stock-transfers/${transferId}/cancel`,
    {
      method: "POST",
      authMode: "appwrite",
      parse: parseStockTransfer,
    },
  );

  return response.data;
}
