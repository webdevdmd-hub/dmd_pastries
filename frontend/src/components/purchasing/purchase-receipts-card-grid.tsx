"use client";

import type { JSX } from "react";

import { PurchaseReceiptAccountingBadge } from "@/components/purchasing/purchase-receipt-accounting-badge";
import { PurchaseReceiptActionsMenu } from "@/components/purchasing/purchase-receipt-actions-menu";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import {
  formatPurchaseReceiptDay,
  nextStepForReceipt,
  type PurchaseReceiptsListProps,
  receiptLinkedDocuments,
} from "@/components/purchasing/purchase-receipts-table";
import { Card } from "@/components/ui/card";

/**
 * Receive-goods records as cards, for phones: an eight-column ledger has no
 * honest layout below md. Clicking a card opens the details drawer; the kebab
 * stops the click so it does not also open the drawer.
 */
export function PurchaseReceiptsCardGrid({
  onView,
  receipts,
  ...actions
}: PurchaseReceiptsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {receipts.map((receipt) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={receipt.id}
          onClick={() => onView(receipt)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(receipt);
              }}
              type="button"
            >
              <span className="truncate font-mono font-medium">{receipt.receiptNumber}</span>
              <span className="truncate text-meta text-foreground-muted">
                {receipt.supplierName} · {receipt.branchName}
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <PurchaseReceiptActionsMenu {...actions} receipt={receipt} />
            </div>
          </div>

          <div className="grid gap-2 px-4 py-3 text-cell">
            <div className="flex flex-wrap items-center gap-1.5">
              <PurchaseReceiptStatusBadge status={receipt.status} />
              <PurchaseReceiptAccountingBadge receipt={receipt} />
            </div>
            <span className="text-foreground-muted">{nextStepForReceipt(receipt)}</span>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Received</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatPurchaseReceiptDay(receipt.receivedDate)}
              </p>
              <p className="text-meta text-foreground-muted">{receipt.receivedByUserName}</p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Linked documents</p>
              <p className="mt-1 break-words font-mono text-cell font-medium">
                {receiptLinkedDocuments(receipt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
