"use client";

import { Eye, MoreHorizontal, RotateCcw } from "lucide-react";
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
import type { StockMovement } from "@/types/stock-movements";

type MovementActionsMenuProps = {
  canReverse: boolean;
  movement: StockMovement;
  onReverse: (movement: StockMovement) => void;
  onView: (movement: StockMovement) => void;
};

function canAttemptReverse(movement: StockMovement): boolean {
  return (
    !movement.isReversal &&
    movement.movementType !== "reversal" &&
    movement.movementType !== "sale_out" &&
    movement.movementType !== "purchase_in"
  );
}

export function MovementActionsMenu({
  canReverse,
  movement,
  onReverse,
  onView,
}: MovementActionsMenuProps): JSX.Element {
  const reverseAllowed = canReverse && canAttemptReverse(movement);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${movement.itemName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(movement)}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/inventory/movements/${movement.id}`}>Open full page</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/inventory/audit/${movement.inventoryItemId}`}>Audit item ledger</Link>
        </DropdownMenuItem>
        {canReverse ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!reverseAllowed}
              onClick={() => {
                if (reverseAllowed) onReverse(movement);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reverse movement
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
