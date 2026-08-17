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

type RecipeActionsMenuProps = {
  canManage: boolean;
  onCreateVersion: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onStatusChange: (recipe: Recipe, status: RecipeStatus, isActive?: boolean) => void;
  onView: (recipe: Recipe) => void;
  recipe: Recipe;
};

export function RecipeActionsMenu({
  canManage,
  onCreateVersion,
  onDelete,
  onStatusChange,
  onView,
  recipe,
}: RecipeActionsMenuProps): JSX.Element {
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
        <DropdownMenuItem onSelect={() => onView(recipe)}>View / Edit</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={recipe.isActive}
              onSelect={() => onStatusChange(recipe, "active", true)}
            >
              Activate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onStatusChange(recipe, "inactive", false)}>
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateVersion(recipe)}>
              Create version
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(recipe)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
