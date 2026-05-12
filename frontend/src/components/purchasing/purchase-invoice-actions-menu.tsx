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
import type { PurchaseInvoice } from "@/types/purchasing";

export function PurchaseInvoiceActionsMenu({
  canManage,
  invoice,
  onCancel,
  onEdit,
  onPost,
  onReceive,
  onView,
}: {
  canManage: boolean;
  invoice: PurchaseInvoice;
  onCancel: (invoice: PurchaseInvoice) => void;
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
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onView(invoice)}>View details</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem
              disabled={invoice.status !== "draft"}
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
              disabled={invoice.status !== "posted"}
              onSelect={() => onReceive(invoice)}
            >
              Receive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={invoice.status === "cancelled"}
              onSelect={() => onCancel(invoice)}
            >
              Cancel
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
