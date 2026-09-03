"use client";

import type { JSX } from "react";

import { PurchaseReceiptAccountingBadge } from "@/components/purchasing/purchase-receipt-accounting-badge";
import {
  type PurchaseReceiptActionHandlers,
  PurchaseReceiptActionsMenu,
} from "@/components/purchasing/purchase-receipt-actions-menu";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseReceipt } from "@/types/purchasing";

export type PurchaseReceiptsListProps = PurchaseReceiptActionHandlers & {
  /** Opens the receipt's details; the whole row is the target. */
  onView: (receipt: PurchaseReceipt) => void;
  receipts: PurchaseReceipt[];
};

export function formatPurchaseReceiptDay(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function nextStepForReceipt(receipt: PurchaseReceipt): string {
  if (receipt.status === "draft") {
    return "Post receipt to update stock";
  }

  if (receipt.status === "posted") {
    if (
      receipt.accountingStatus === "pending_bill_posting" ||
      receipt.accountingStatus === "pending_accounting_journal"
    ) {
      return receipt.accountingStatusDetail;
    }
    return "Return items if needed";
  }

  return "No action";
}

/** The documents this receipt came from, on one line. */
export function receiptLinkedDocuments(receipt: PurchaseReceipt): string {
  const parts = [
    receipt.purchaseOrderNumber ?? (receipt.purchaseOrderId ? "PO unavailable" : null),
    receipt.purchaseInvoiceNumber ?? (receipt.purchaseInvoiceId ? "Bill unavailable" : null),
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : "Not linked";
}

export function PurchaseReceiptsTable({
  onView,
  receipts,
  ...actions
}: PurchaseReceiptsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Receipt</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Linked documents</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Received by</TableHead>
          <TableHead>Next step</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {receipts.map((receipt) => (
          // The row opens the drawer; the number is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={receipt.id} onClick={() => onView(receipt)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(receipt);
                }}
                type="button"
              >
                <span className="font-mono font-medium">{receipt.receiptNumber}</span>
                {/* Branch is how you recognise a receipt you have found, not
                    how you find one. It rides under the number. */}
                <span className="text-meta text-foreground-muted">{receipt.branchName}</span>
              </button>
            </TableCell>
            <TableCell>{receipt.supplierName}</TableCell>
            <TableCell className="tabular-nums">
              {formatPurchaseReceiptDay(receipt.receivedDate)}
            </TableCell>
            <TableCell className="font-mono">{receiptLinkedDocuments(receipt)}</TableCell>
            <TableCell>
              {/* Two badges, one column. Posting state and accounting state are
                  independent, and the second is why a storekeeper is here. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <PurchaseReceiptStatusBadge status={receipt.status} />
                <PurchaseReceiptAccountingBadge receipt={receipt} />
              </div>
            </TableCell>
            <TableCell>{receipt.receivedByUserName}</TableCell>
            <TableCell className="min-w-56 whitespace-normal text-foreground-muted">
              {nextStepForReceipt(receipt)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <PurchaseReceiptActionsMenu {...actions} receipt={receipt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
