"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PurchaseReceipt } from "@/types/purchasing";

export function PurchaseReceiptActionsMenu({
  canManage,
  onCancel,
  onPost,
  onView,
  receipt,
}: {
  canManage: boolean;
  onCancel: (receipt: PurchaseReceipt) => void;
  onPost: (receipt: PurchaseReceipt) => void;
  onView: (receipt: PurchaseReceipt) => void;
  receipt: PurchaseReceipt;
}): JSX.Element {
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
        <DropdownMenuItem onSelect={() => onView(receipt)}>View details</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem
              disabled={receipt.status !== "draft"}
              onSelect={() => onPost(receipt)}
            >
              Post receipt
            </DropdownMenuItem>
            <DropdownMenuItem
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
