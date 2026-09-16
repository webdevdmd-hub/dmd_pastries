import type { PurchaseOrder } from "@/types/purchasing";

export type NextStepPermissions = {
  canConvertToBill: boolean;
  canReceiveOrder: boolean;
  canUpdateStatus: boolean;
};

/**
 * The next step on a purchase order row.
 *
 * It depends on who is reading: without the permission, the cell reports the
 * state instead of instructing an action the menu denies.
 *
 * It also depends on what has already happened, which the list could not see.
 * The list response carried no items and no document chain, so on production
 * on 2026-09-16 PO-000001 -- received, billed as QAF-INV-1001 and paid in full
 * -- read "Ready to bill", an instruction to raise a second bill for goods
 * already billed and paid. The response now carries has_active_bill and line
 * counts (TODOS T-R).
 *
 * Regression: ISSUE-033 — a billed and paid purchase order said "Ready to bill"
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 */
export function nextStepForOrder(order: PurchaseOrder, permissions: NextStepPermissions): string {
  if (order.status === "draft") {
    return permissions.canUpdateStatus ? "Mark as issued" : "Awaiting issue";
  }

  if (order.status === "ordered") {
    return permissions.canReceiveOrder ? "Receive goods" : "Awaiting delivery";
  }

  if (order.status === "partially_received") {
    // Lines, never pooled quantity: 1 of 500 and 499 of 500 are not the same
    // job, and kilograms do not add to litres.
    const progress =
      order.stockLineCount > 0
        ? ` (${String(order.receivedLineCount)} of ${String(order.stockLineCount)} lines)`
        : "";
    return permissions.canReceiveOrder
      ? `Receive remaining goods${progress}`
      : `Part delivered${progress}`;
  }

  if (order.status === "received") {
    if (order.hasActiveBill) {
      return "Billed";
    }
    return permissions.canConvertToBill ? "Ready to bill" : "Received in full";
  }

  return "No action";
}
