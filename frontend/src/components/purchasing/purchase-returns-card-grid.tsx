"use client";

import type { JSX } from "react";

import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import {
  creditDisplayForReturn,
  formatPurchaseReturnCurrency,
  formatPurchaseReturnDay,
  nextStepForReturn,
  PurchaseReturnActionsMenu,
  type PurchaseReturnsListProps,
} from "@/components/purchasing/purchase-returns-table";
import { Card } from "@/components/ui/card";

/**
 * Vendor credits as cards, for phones: a ten-column ledger has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function PurchaseReturnsCardGrid({
  canCancel,
  canPost,
  canReverse,
  onCancel,
  onPost,
  onReverse,
  onView,
  returns,
}: PurchaseReturnsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {returns.map((purchaseReturn) => {
        const creditDisplay = creditDisplayForReturn(purchaseReturn);

        return (
          <Card
            className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
            key={purchaseReturn.id}
            onClick={() => onView(purchaseReturn)}
          >
            <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
              <button
                className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(purchaseReturn);
                }}
                type="button"
              >
                <span className="truncate font-mono font-medium">
                  {purchaseReturn.returnNumber}
                </span>
                <span className="truncate text-meta text-foreground-muted">
                  {purchaseReturn.supplierName} ·{" "}
                  {formatPurchaseReturnDay(purchaseReturn.returnDate)}
                </span>
              </button>
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                <PurchaseReturnStatusBadge status={purchaseReturn.status} />
                <PurchaseReturnActionsMenu
                  canCancel={canCancel}
                  canPost={canPost}
                  canReverse={canReverse}
                  onCancel={onCancel}
                  onPost={onPost}
                  onReverse={onReverse}
                  purchaseReturn={purchaseReturn}
                />
              </div>
            </div>

            <div className="grid gap-1 px-4 py-3 text-cell">
              <span className="font-mono text-meta text-foreground-muted">
                Receipt {purchaseReturn.purchaseReceiptNumber}
                {purchaseReturn.purchaseInvoiceNumber
                  ? ` · Bill ${purchaseReturn.purchaseInvoiceNumber}`
                  : ""}
              </span>
              <span className="text-foreground-muted">{nextStepForReturn(purchaseReturn)}</span>
            </div>

            <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
              <div className="min-w-0 border-r border-workspace-border px-4 py-3">
                <p className="text-meta text-foreground-muted">Total</p>
                <p className="mt-1 break-words text-cell font-medium tabular-nums">
                  {formatPurchaseReturnCurrency(purchaseReturn.returnTotal)}
                </p>
              </div>
              <div className="min-w-0 px-4 py-3">
                <p className="text-meta text-foreground-muted">Open credit</p>
                <p className="mt-1 break-words text-cell font-medium tabular-nums">
                  {creditDisplay.value}
                </p>
                {creditDisplay.helper ? (
                  <p className="text-meta text-foreground-muted">{creditDisplay.helper}</p>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
