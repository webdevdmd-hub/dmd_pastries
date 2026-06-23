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

export function PurchaseInvoiceActionsMenu({
  canConvertToReceipt,
  canManage,
  invoice,
  isLoading,
  onCancel,
  onConvertToReceipt,
  onEdit,
  onPost,
  onReceive,
  onView,
}: {
  canConvertToReceipt: boolean;
  canManage: boolean;
  invoice: PurchaseInvoice;
  isLoading?: boolean;
  onCancel: (invoice: PurchaseInvoice) => void;
  onConvertToReceipt: (invoice: PurchaseInvoice) => void;
  onEdit: (invoice: PurchaseInvoice) => void;
  onPost: (invoice: PurchaseInvoice) => void;
  onReceive: (invoice: PurchaseInvoice) => void;
  onView: (invoice: PurchaseInvoice) => void;
}): JSX.Element {
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
        <DropdownMenuItem onSelect={() => onView(invoice)}>View details</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem
              disabled={invoice.status === "cancelled"}
              onSelect={() => onEdit(invoice)}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={invoice.status !== "draft"}
              onSelect={() => onPost(invoice)}
            >
              Post
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={invoice.status !== "posted" || !invoice.canReceiveStock}
              onSelect={() => onReceive(invoice)}
            >
              Receive now
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canConvertToReceipt || invoice.status !== "posted" || !invoice.canReceiveStock}
              onSelect={() => onConvertToReceipt(invoice)}
            >
              Convert to receipt
            </DropdownMenuItem>
            {invoice.status === "posted" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onCancel(invoice)}>Cancel Bill</DropdownMenuItem>
              </>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
