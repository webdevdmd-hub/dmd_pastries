import type { MovementType as InventoryMovementType } from "@/types/inventory";
import type { MovementType as StockMovementType } from "@/types/stock-movements";

export type StockMovementDisplaySource = {
  movementType: InventoryMovementType | StockMovementType;
  movementLabel: string;
  sourceModuleLabel: string | null;
  sourceReferenceLabel: string | null;
  movementDescription: string | null;
  referenceType: string | null;
  referenceNumber: string | null;
  reason: string | null;
  createdByUserName: string;
  fromStockLocationName: string | null;
  toStockLocationName: string | null;
};

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  opening_stock: "Opening Stock",
  purchase_in: "Purchase / GRN",
  sale_out: "POS Sale",
  adjustment_in: "Stock Adjustment In",
  adjustment_out: "Stock Adjustment Out",
  wastage: "Wastage",
  return_in: "Sales Return",
  transfer: "Stock Transfer",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  production_in: "Production Output",
  production_out: "Production Consumption",
  purchase_return_out: "Vendor Credit",
  purchase_bill_cancel_out: "Purchase Cancellation",
  reversal: "Reversal",
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function referenceLabel(movement: StockMovementDisplaySource): string {
  const displayReference = clean(movement.sourceReferenceLabel);
  if (displayReference) return displayReference;

  const referenceNumber = clean(movement.referenceNumber);
  if (referenceNumber)
    return referenceNumber.startsWith("#") ? referenceNumber : `#${referenceNumber}`;

  const referenceType = clean(movement.referenceType);
  return referenceType ? referenceType.replace(/_/g, " ") : "Manual";
}

function withReason(prefix: string, reason: string | null): string {
  const cleanReason = clean(reason);
  return cleanReason ? `${prefix} - ${cleanReason}` : prefix;
}

function locationName(value: string | null): string {
  return clean(value) ?? "Unknown location";
}

export function movementTypeLabel(type: InventoryMovementType | StockMovementType): string {
  return STOCK_MOVEMENT_TYPE_LABELS[type];
}

export function stockMovementDescription(movement: StockMovementDisplaySource): string {
  const backendDescription = clean(movement.movementDescription);
  if (backendDescription) return backendDescription;

  const actor = clean(movement.createdByUserName) ?? "System";
  const reference = referenceLabel(movement);

  switch (movement.movementType) {
    case "opening_stock":
      return `Opening stock created by ${actor}`;
    case "purchase_in":
      return `Purchased through GRN ${reference}`;
    case "sale_out":
      return `Sold through POS Receipt ${reference}`;
    case "return_in":
      if (movement.referenceType === "sale_void") {
        return `Returned from voided POS Receipt ${reference}`;
      }
      if (movement.referenceType === "sales_return") {
        return `Returned from Sales Return ${reference}`;
      }
      return `Returned stock ${reference}`;
    case "production_out":
      return `Used in Production Batch ${reference}`;
    case "production_in":
      return `Produced from Manufacturing Batch ${reference}`;
    case "wastage":
      if (movement.referenceType === "production_batch") {
        return `Wastage from Production Batch ${reference}`;
      }
      return withReason(`Wastage recorded by ${actor}`, movement.reason);
    case "transfer":
    case "transfer_in":
    case "transfer_out":
      return `Transferred from ${locationName(movement.fromStockLocationName)} to ${locationName(
        movement.toStockLocationName,
      )}`;
    case "adjustment_in":
    case "adjustment_out":
      return withReason(`Manual stock adjustment by ${actor}`, movement.reason);
    case "purchase_return_out":
      return `Returned to supplier through Vendor Credit ${reference}`;
    case "purchase_bill_cancel_out":
      return `Stock removed due to purchase cancellation ${reference}`;
    case "reversal":
      return `Reversal of stock movement ${reference}`;
    default:
      return withReason(
        clean(movement.movementLabel) ?? movementTypeLabel(movement.movementType),
        movement.reason,
      );
  }
}

export function sourceModuleLabel(movement: StockMovementDisplaySource): string {
  return clean(movement.sourceModuleLabel) ?? "Inventory";
}

export function sourceReferenceLabel(movement: StockMovementDisplaySource): string {
  return referenceLabel(movement);
}
