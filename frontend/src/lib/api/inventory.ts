import { apiRequest } from "@/lib/api/client";
import type {
  CreateExpiryBatchPayload,
  ExpiryAlertFilters,
  ExpiryBatch,
  ExpiryBatchStatus,
  InventoryFilters,
  InventoryItem,
  InventoryItemType,
  InventoryStatus,
  LowStockFilters,
  MovementType,
  OpeningStockPayload,
  StockAdjustmentPayload,
  StockMovement,
  StockMovementFilters,
  UpdateExpiryBatchPayload,
  UpdateExpiryBatchStatusPayload,
} from "@/types/inventory";

type BackendOpeningStockPayload = {
  branch_id: string;
  item_type: InventoryItemType;
  product_id?: string;
  ingredient_id?: string;
  packaging_item_id?: string;
  unit_id: string;
  quantity: number;
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
  return value === "product" || value === "ingredient" || value === "packaging";
}

function isInventoryStatus(value: unknown): value is InventoryStatus {
  return value === "active" || value === "inactive";
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

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    productId: nullableString(value.product_id),
    ingredientId: nullableString(value.ingredient_id),
    packagingItemId: nullableString(value.packaging_item_id),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    itemName: stringValue(value.item_name, "Inventory item"),
    itemCode: stringValue(value.item_code),
    currentQuantity: numberValue(value.current_quantity),
    reservedQuantity: numberValue(value.reserved_quantity),
    availableQuantity: numberValue(value.available_quantity),
    reorderLevel: numberValue(value.reorder_level),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    isExpiryTracked: booleanValue(value.is_expiry_tracked),
    lowStock: booleanValue(value.low_stock),
    status: isInventoryStatus(value.status) ? value.status : "active",
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
    referenceType: nullableString(value.reference_type),
    referenceId: nullableString(value.reference_id),
    reason: nullableString(value.reason),
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
    inventoryItemId: stringValue(value.inventory_item_id),
    batchNumber: stringValue(value.batch_number, "Batch"),
    quantity: numberValue(value.quantity),
    expiryDate: stringValue(value.expiry_date),
    receivedDate: stringValue(value.received_date),
    status: isExpiryBatchStatus(value.status) ? value.status : "active",
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
    ...(payload.ingredientId ? { ingredient_id: payload.ingredientId } : {}),
    ...(payload.packagingItemId ? { packaging_item_id: payload.packagingItemId } : {}),
    unit_id: payload.unitId,
    quantity: payload.quantity,
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

export async function getInventory(params: InventoryFilters): Promise<InventoryItem[]> {
  const response = await apiRequest<InventoryItem[]>(
    `/api/v1/inventory${queryString({
      search: params.search,
      branch_id: params.branchId,
      item_type: params.itemType,
      status: params.status,
      low_stock: params.lowStockOnly,
      expiry_tracked: params.expiryTrackedOnly,
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
