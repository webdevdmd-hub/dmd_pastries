import type { PurchaseOrder, PurchaseOrderItem } from "@/types/purchasing";

/**
 * Ordered-versus-received arithmetic for purchase orders.
 *
 * This lived inline in three components that each answered "how much is still
 * owed" slightly differently, which is how a partially received order came to
 * show its full ordered quantity on the detail page and a bare unit-less number
 * in the receive dialog. One module, one answer, and it is testable.
 */

/** Account rows buy an expense, not stock, so they never have a received half. */
export function isStockLine(item: PurchaseOrderItem): boolean {
  return item.lineType !== "account" && item.itemType !== "account";
}

/** What the supplier still owes on a line. Never negative, even on over-receipt. */
export function outstandingQuantity(item: PurchaseOrderItem): number {
  if (!isStockLine(item)) return 0;

  return Math.max(item.quantityOrdered - item.quantityReceived, 0);
}

export function hasOutstandingStock(order: PurchaseOrder): boolean {
  return order.items.some((item) => outstandingQuantity(item) > 0);
}

/**
 * Value of the goods not yet delivered. This is a different question from the
 * bill's balance due, which only exists once a supplier has actually billed.
 */
export function unreceivedValue(order: PurchaseOrder): number {
  return order.items.reduce((total, item) => total + outstandingQuantity(item) * item.unitCost, 0);
}

export type ReceivingProgress = {
  completeLines: number;
  stockLines: number;
};

/**
 * Progress is counted in lines, never in pooled quantity: adding kilograms to
 * litres produces a number that describes nothing.
 */
export function receivingProgress(order: PurchaseOrder): ReceivingProgress {
  const stockLines = order.items.filter(isStockLine);

  return {
    completeLines: stockLines.filter((item) => outstandingQuantity(item) === 0).length,
    stockLines: stockLines.length,
  };
}

export type UnitTotal = {
  quantity: number;
  unit: string;
};

/**
 * Group quantities by unit for display. Entries that are zero, negative or
 * unparseable contribute nothing — a row the operator zeroed is a row that is
 * not being received, and it must not inflate the summary.
 */
export function totalsByUnit(entries: { quantity: number; unit: string }[]): UnitTotal[] {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) continue;

    totals.set(entry.unit, (totals.get(entry.unit) ?? 0) + entry.quantity);
  }

  return [...totals.entries()].map(([unit, quantity]) => ({ quantity, unit }));
}
