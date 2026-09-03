"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PurchaseInvoice } from "@/types/purchasing";

export type PurchaseInvoiceActionHandlers = {
  canConvertToReceipt: boolean;
  canManage: boolean;
  canPost: boolean;
  onCancel: (invoice: PurchaseInvoice) => void;
  onConvertToReceipt: (invoice: PurchaseInvoice) => void;
  onEdit: (invoice: PurchaseInvoice) => void;
  onPost: (invoice: PurchaseInvoice) => void;
  onReceive: (invoice: PurchaseInvoice) => void;
};

/**
 * Actions only. Viewing is the row's own click, so "View details" no longer
 * sits here; a reader with no write rights sees no menu at all.
 */
export function PurchaseInvoiceActionsMenu({
  canConvertToReceipt,
  canManage,
  canPost,
  invoice,
  isLoading,
  onCancel,
  onConvertToReceipt,
  onEdit,
  onPost,
  onReceive,
}: PurchaseInvoiceActionHandlers & {
  invoice: PurchaseInvoice;
  isLoading?: boolean;
}): JSX.Element | null {
  if (!canManage && !canPost) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${invoice.invoiceNumber}`}
          disabled={isLoading}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManage ? (
          <DropdownMenuItem
            disabled={invoice.status === "cancelled"}
            onSelect={() => onEdit(invoice)}
          >
            Edit
          </DropdownMenuItem>
        ) : null}
        {canPost ? (
          <DropdownMenuItem disabled={invoice.status !== "draft"} onSelect={() => onPost(invoice)}>
            Post bill
          </DropdownMenuItem>
        ) : null}
        {canManage ? (
          <>
            <DropdownMenuItem
              disabled={invoice.status !== "posted" || !invoice.canReceiveStock}
              onSelect={() => onReceive(invoice)}
            >
              Receive now
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={
                !canConvertToReceipt || invoice.status !== "posted" || !invoice.canReceiveStock
              }
              onSelect={() => onConvertToReceipt(invoice)}
            >
              Convert to receipt
            </DropdownMenuItem>
            {invoice.status === "posted" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-danger-text" onSelect={() => onCancel(invoice)}>
                  Cancel bill
                </DropdownMenuItem>
              </>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
