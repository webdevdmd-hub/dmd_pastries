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
import type { RecordStatus, TaxRate } from "@/types/settings";

export type TaxRateActionHandlers = {
  canManage: boolean;
  onDeactivate: (taxRate: TaxRate) => void;
  onEdit: (taxRate: TaxRate) => void;
  onStatusChange: (taxRate: TaxRate, status: RecordStatus) => void;
};

/**
 * Actions only, and only for someone who has them.
 *
 * Every item used to render for everyone with `disabled={!canManage}`, so a
 * viewer opened a menu of four dead rows.
 */
export function TaxRateActionsMenu({
  canManage,
  onDeactivate,
  onEdit,
  onStatusChange,
  taxRate,
}: TaxRateActionHandlers & { taxRate: TaxRate }): JSX.Element | null {
  if (!canManage) {
    return null;
  }

  const isActive = taxRate.status === "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${taxRate.taxName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(taxRate)}>Edit tax rate</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onStatusChange(taxRate, isActive ? "inactive" : "active")}
        >
          {isActive ? "Mark inactive" : "Mark active"}
        </DropdownMenuItem>
        {isActive ? (
          <>
            <DropdownMenuSeparator />
            {/* A second route to inactive, through the delete endpoint the
                backend soft-deletes. Kept because the two are not the same
                call, but named for what an operator sees happen. */}
            <DropdownMenuItem
              className="text-danger-text focus:text-danger-text"
              onSelect={() => onDeactivate(taxRate)}
            >
              Retire this rate
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
