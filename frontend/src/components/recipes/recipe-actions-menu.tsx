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
import type { Recipe, RecipeStatus } from "@/types/recipes";

export type RecipeActionHandlers = {
  canManage: boolean;
  onCreateVersion: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  /** Opens the builder over the list. Not a navigation. */
  onEdit: (recipe: Recipe) => void;
  onStatusChange: (recipe: Recipe, status: RecipeStatus, isActive?: boolean) => void;
};

/**
 * Actions only. "View / Edit" is gone: the row opens the drawer, and the
 * drawer header opens the builder, so one menu item no longer stands for
 * two different intentions. A reader with no manage rights sees no menu.
 */
export function RecipeActionsMenu({
  canManage,
  onCreateVersion,
  onDelete,
  onEdit,
  onStatusChange,
  recipe,
}: RecipeActionHandlers & { recipe: Recipe }): JSX.Element | null {
  if (!canManage) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${recipe.recipeName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(recipe)}>Edit in builder</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={recipe.isActive}
          onSelect={() => onStatusChange(recipe, "active", true)}
        >
          Activate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!recipe.isActive}
          onSelect={() => onStatusChange(recipe, "inactive", false)}
        >
          Deactivate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreateVersion(recipe)}>Create version</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(recipe)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
