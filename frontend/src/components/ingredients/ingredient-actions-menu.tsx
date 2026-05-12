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
import type { Ingredient, IngredientStatus } from "@/types/ingredient";

type IngredientActionsMenuProps = {
  canManage: boolean;
  item: Ingredient;
  onDelete: (item: Ingredient) => void;
  onEdit: (item: Ingredient) => void;
  onStatusChange: (item: Ingredient, status: IngredientStatus) => void;
  onView: (item: Ingredient) => void;
};

export function IngredientActionsMenu({
  canManage,
  item,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: IngredientActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${item.ingredientName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(item)}>View details</DropdownMenuItem>
        {canManage ? (
          <DropdownMenuItem onClick={() => onEdit(item)}>Edit ingredient</DropdownMenuItem>
        ) : null}
        {canManage ? (
          <DropdownMenuItem
            onClick={() => onStatusChange(item, item.status === "active" ? "inactive" : "active")}
          >
            {item.status === "active" ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        ) : null}
        {canManage ? (
          <DropdownMenuItem className="text-red-700" onClick={() => onDelete(item)}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
