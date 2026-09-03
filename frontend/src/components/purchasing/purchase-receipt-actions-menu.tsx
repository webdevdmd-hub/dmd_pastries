"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PurchaseReceipt } from "@/types/purchasing";

export type PurchaseReceiptActionHandlers = {
  canManage: boolean;
  canReturn: boolean;
  onCancel: (receipt: PurchaseReceipt) => void;
  onPost: (receipt: PurchaseReceipt) => void;
  onReturn: (receipt: PurchaseReceipt) => void;
};

/**
 * Actions only. Viewing is the row's own click, so "View details" no longer
 * sits here; a reader with no write rights sees no menu at all.
 */
export function PurchaseReceiptActionsMenu({
  canManage,
  canReturn,
  onCancel,
  onPost,
  onReturn,
  receipt,
}: PurchaseReceiptActionHandlers & { receipt: PurchaseReceipt }): JSX.Element | null {
  if (!canManage && !canReturn) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${receipt.receiptNumber}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManage ? (
          <DropdownMenuItem disabled={receipt.status !== "draft"} onSelect={() => onPost(receipt)}>
            Post receipt
          </DropdownMenuItem>
        ) : null}
        {canReturn ? (
          <DropdownMenuItem
            disabled={receipt.status !== "posted"}
            onSelect={() => onReturn(receipt)}
          >
            Return items
          </DropdownMenuItem>
        ) : null}
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger-text"
              disabled={receipt.status === "cancelled"}
              onSelect={() => onCancel(receipt)}
            >
              Cancel receipt
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
