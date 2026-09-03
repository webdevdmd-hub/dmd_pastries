"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Expense } from "@/types/expenses";

export type ExpenseActionHandlers = {
  canDelete: boolean;
  canEdit: boolean;
  onDelete: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
};

/**
 * Actions only. The row itself opens the details, so "View details" is gone,
 * and with it the eye icon that used to stand in for a kebab -- an eye promises
 * a preview and opened a menu. A reader with no write rights sees no menu.
 */
export function ExpenseActionsMenu({
  canDelete,
  canEdit,
  expense,
  onDelete,
  onEdit,
}: ExpenseActionHandlers & { expense: Expense }): JSX.Element | null {
  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${expense.expenseNumber}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <DropdownMenuItem onSelect={() => onEdit(expense)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit expense
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            {canEdit ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className="text-danger-text focus:text-danger-text"
              onSelect={() => onDelete(expense)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete permanently
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
