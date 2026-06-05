import type { InventoryItemType } from "@/types/inventory";

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
  | "production_out"
  | "reversal";

export type MovementDirection = "in" | "out" | "neutral";

export type StockMovement = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  inventoryItemId: string;
  itemType: InventoryItemType;
  itemName: string;
  movementType: MovementType;
  movementDirection: MovementDirection;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitSymbol: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  reason: string | null;
  notes: string | null;
  isReversal: boolean;
  reversedMovementId: string | null;
  unitCostSnapshot: number;
  totalCost: number;
  valuationMethod: string | null;
  accountingJournalEntryId: string | null;
  createdByUserName: string;
  createdAt: string;
};

export type MovementSummaryByType = {
  movementType: MovementType;
  quantity: number;
  count: number;
};

export type MovementSummary = {
  totalInQuantity: number;
  totalOutQuantity: number;
  netQuantity: number;
  movementCount: number;
  byMovementType: MovementSummaryByType[];
};

export type AuditResult = {
  inventoryItemId: string;
  currentQuantity: number;
  calculatedQuantityFromMovements: number;
  difference: number;
  isBalanced: boolean;
  totalIn: number;
  totalOut: number;
  movementCount: number;
};

export type ManualMovementPayload = {
  inventoryItemId: string;
  movementType: Extract<MovementType, "adjustment_in" | "adjustment_out" | "wastage" | "return_in">;
  quantity: number;
  reason: string;
  notes?: string;
};

export type ReversalPayload = {
  reason: string;
};

export type StockMovementFilters = {
  search: string;
  branchId: string;
  itemType: InventoryItemType | "all";
  movementType: MovementType | "all";
  direction: MovementDirection | "all";
  dateFrom: string;
  dateTo: string;
  createdBy: string;
};

export type StockMovementSummaryParams = Pick<
  StockMovementFilters,
  "branchId" | "itemType" | "movementType" | "direction" | "dateFrom" | "dateTo"
>;
