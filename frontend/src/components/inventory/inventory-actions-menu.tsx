"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InventoryItem } from "@/types/inventory";

type InventoryActionsMenuProps = {
  canManage: boolean;
  item: InventoryItem;
  onAddBatch: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  onView: (item: InventoryItem) => void;
  showBatchAction: boolean;
  showViewAction: boolean;
};

/**
 * Row actions for an initialized inventory item, collapsed into one trigger.
 *
 * The four actions this replaces were four separate icon buttons in a single
 * table cell, which is up to four 32px targets per row on a list that can run
 * to hundreds of rows. The gates are carried over verbatim from that cell so
 * the menu never offers an action the icon row would have hidden.
 *
 * Catalog rows (`status === "not_initialized"`) are deliberately not routed
 * through here: their only action is "Add Opening Stock", and burying a row's
 * single call to action inside an overflow menu costs a click and hides the
 * one thing that row exists to prompt.
 */
export function InventoryActionsMenu({
  canManage,
  item,
  onAddBatch,
  onAdjust,
  onView,
  showBatchAction,
  showViewAction,
}: InventoryActionsMenuProps): JSX.Element {
  const canAdjust = canManage;
  const canAddBatch = canManage && showBatchAction && item.isExpiryTracked;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${item.itemName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showViewAction ? (
          <DropdownMenuItem onClick={() => onView(item)}>View details</DropdownMenuItem>
        ) : null}
        {canAdjust ? (
          <DropdownMenuItem onClick={() => onAdjust(item)}>Adjust stock</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/inventory/movements?item=${item.id}`}>Movements</Link>
        </DropdownMenuItem>
        {canAddBatch ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAddBatch(item)}>Add expiry batch</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
