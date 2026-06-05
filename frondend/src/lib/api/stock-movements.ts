import { apiRequest } from "@/lib/api/client";
import type { InventoryItemType } from "@/types/inventory";
import type {
  AuditResult,
  ManualMovementPayload,
  MovementDirection,
  MovementSummary,
  MovementSummaryByType,
  MovementType,
  ReversalPayload,
  StockMovement,
  StockMovementFilters,
  StockMovementSummaryParams,
} from "@/types/stock-movements";

type BackendManualMovementPayload = {
  inventory_item_id: string;
  movement_type: ManualMovementPayload["movementType"];
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
  if (typeof value === "number") return value;
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
    value === "production_out" ||
    value === "reversal"
  );
}

function isMovementDirection(value: unknown): value is MovementDirection {
  return value === "in" || value === "out" || value === "neutral";
}

function inferMovementDirection(type: MovementType): MovementDirection {
  if (
    type === "opening_stock" ||
    type === "purchase_in" ||
    type === "adjustment_in" ||
    type === "return_in" ||
    type === "transfer_in" ||
    type === "production_in"
  ) {
    return "in";
  }

  if (
    type === "sale_out" ||
    type === "adjustment_out" ||
    type === "wastage" ||
    type === "transfer_out" ||
    type === "production_out"
  ) {
    return "out";
  }

  return "neutral";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) return value.map(parser);
  if (isObject(value) && Array.isArray(value.items)) return value.items.map(parser);
  if (isObject(value) && Array.isArray(value.data)) return value.data.map(parser);
  if (isObject(value) && Array.isArray(value.movements)) return value.movements.map(parser);
  return [];
}

function parseStockMovement(value: unknown): StockMovement {
  if (!isObject(value)) {
    throw new Error("Backend stock movement payload is invalid.");
  }

  const movementType = isMovementType(value.movement_type) ? value.movement_type : "adjustment_in";

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    inventoryItemId: stringValue(value.inventory_item_id),
    itemType: isInventoryItemType(value.item_type) ? value.item_type : "product",
    itemName: stringValue(value.item_name, "Inventory item"),
    movementType,
    movementDirection: isMovementDirection(value.movement_direction)
      ? value.movement_direction
      : inferMovementDirection(movementType),
    quantity: numberValue(value.quantity),
    beforeQuantity: numberValue(value.before_quantity),
    afterQuantity: numberValue(value.after_quantity),
    unitSymbol: stringValue(value.unit_symbol),
    referenceType: nullableString(value.reference_type),
    referenceId: nullableString(value.reference_id),
    referenceNumber: nullableString(value.reference_number),
    reason: nullableString(value.reason),
    notes: nullableString(value.notes),
    isReversal: booleanValue(value.is_reversal, movementType === "reversal"),
    reversedMovementId: nullableString(value.reversed_movement_id),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    valuationMethod: nullableString(value.valuation_method),
    accountingJournalEntryId: nullableString(value.accounting_journal_entry_id),
    createdByUserName: stringValue(value.created_by_user_name, "System"),
    createdAt: stringValue(value.created_at),
  };
}

function parseSummaryByTypeEntry(type: string, value: unknown): MovementSummaryByType | null {
  if (!isMovementType(type)) return null;

  if (typeof value === "number") {
    return { movementType: type, quantity: value, count: 0 };
  }

  if (isObject(value)) {
    return {
      movementType: type,
      quantity: numberValue(value.quantity ?? value.total_quantity),
      count: numberValue(value.count ?? value.movement_count),
    };
  }

  return null;
}

function parseSummaryByType(value: unknown): MovementSummaryByType[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!isObject(item) || !isMovementType(item.movement_type)) return null;
        return {
          movementType: item.movement_type,
          quantity: numberValue(item.quantity ?? item.total_quantity),
          count: numberValue(item.count ?? item.movement_count),
        };
      })
      .filter((item): item is MovementSummaryByType => item !== null);
  }

  if (isObject(value)) {
    return Object.entries(value)
      .map(([type, item]) => parseSummaryByTypeEntry(type, item))
      .filter((item): item is MovementSummaryByType => item !== null);
  }

  return [];
}

function parseMovementSummary(value: unknown): MovementSummary {
  if (!isObject(value)) {
    return {
      totalInQuantity: 0,
      totalOutQuantity: 0,
      netQuantity: 0,
      movementCount: 0,
      byMovementType: [],
    };
  }

  return {
    totalInQuantity: numberValue(value.total_in_quantity),
    totalOutQuantity: numberValue(value.total_out_quantity),
    netQuantity: numberValue(value.net_quantity),
    movementCount: numberValue(value.movement_count),
    byMovementType: parseSummaryByType(value.by_movement_type),
  };
}

function parseAuditResult(value: unknown): AuditResult {
  if (!isObject(value)) {
    throw new Error("Backend audit payload is invalid.");
  }

  return {
    inventoryItemId: stringValue(value.inventory_item_id),
    currentQuantity: numberValue(value.current_quantity),
    calculatedQuantityFromMovements: numberValue(value.calculated_quantity_from_movements),
    difference: numberValue(value.difference),
    isBalanced: booleanValue(value.is_balanced),
    totalIn: numberValue(value.total_in),
    totalOut: numberValue(value.total_out),
    movementCount: numberValue(value.movement_count),
  };
}

function queryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function movementQuery(params: Partial<StockMovementFilters>): string {
  return queryString({
    search: params.search,
    branch_id: params.branchId,
    item_type: params.itemType,
    movement_type: params.movementType,
    direction: params.direction,
    date_from: params.dateFrom,
    date_to: params.dateTo,
    created_by: params.createdBy,
  });
}

export async function getStockMovements(params: StockMovementFilters): Promise<StockMovement[]> {
  const response = await apiRequest<StockMovement[]>(
    `/api/v1/stock-movements${movementQuery(params)}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseStockMovement),
    },
  );

  return response.data;
}

export async function getStockMovementById(id: string): Promise<StockMovement> {
  const response = await apiRequest<StockMovement>(`/api/v1/stock-movements/${id}`, {
    authMode: "appwrite",
    parse: parseStockMovement,
  });

  return response.data;
}

export async function getInventoryItemMovements(
  inventoryItemId: string,
  params: Partial<StockMovementFilters>,
): Promise<StockMovement[]> {
  const response = await apiRequest<StockMovement[]>(
    `/api/v1/stock-movements/inventory/${inventoryItemId}${movementQuery(params)}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseStockMovement),
    },
  );

  return response.data;
}

export async function createManualMovement(payload: ManualMovementPayload): Promise<StockMovement> {
  const response = await apiRequest<StockMovement, BackendManualMovementPayload>(
    "/api/v1/stock-movements/manual",
    {
      method: "POST",
      authMode: "appwrite",
      body: {
        inventory_item_id: payload.inventoryItemId,
        movement_type: payload.movementType,
        quantity: payload.quantity,
        reason: payload.reason,
        ...(payload.notes ? { notes: payload.notes } : {}),
      },
      parse: parseStockMovement,
    },
  );

  return response.data;
}

export async function reverseStockMovement(
  id: string,
  payload: ReversalPayload,
): Promise<StockMovement> {
  const response = await apiRequest<StockMovement, ReversalPayload>(
    `/api/v1/stock-movements/${id}/reverse`,
    {
      method: "POST",
      authMode: "appwrite",
      body: payload,
      parse: parseStockMovement,
    },
  );

  return response.data;
}

export async function getStockMovementSummary(
  params: StockMovementSummaryParams,
): Promise<MovementSummary> {
  const response = await apiRequest<MovementSummary>(
    `/api/v1/stock-movements/summary${queryString({
      branch_id: params.branchId,
      item_type: params.itemType,
      movement_type: params.movementType,
      direction: params.direction,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: parseMovementSummary,
    },
  );

  return response.data;
}

export async function getInventoryAudit(inventoryItemId: string): Promise<AuditResult> {
  const response = await apiRequest<AuditResult>(
    `/api/v1/stock-movements/audit/${inventoryItemId}`,
    {
      authMode: "appwrite",
      parse: parseAuditResult,
    },
  );

  return response.data;
}
