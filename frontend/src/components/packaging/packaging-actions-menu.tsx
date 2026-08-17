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
import type { PackagingItem } from "@/types/packaging";

type PackagingActionsMenuProps = {
  canManage: boolean;
  item: PackagingItem;
  onDelete: (item: PackagingItem) => void;
  onEdit: (item: PackagingItem) => void;
  onStatusChange: (item: PackagingItem, status: PackagingItem["status"]) => void;
  onView: (item: PackagingItem) => void;
};

export function PackagingActionsMenu({
  canManage,
  item,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: PackagingActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${item.packagingName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onView(item)}>View details</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onSelect={() => onEdit(item)}>Edit packaging</DropdownMenuItem>
            <DropdownMenuSeparator />
            {item.status === "active" ? (
              <DropdownMenuItem onSelect={() => onStatusChange(item, "inactive")}>
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onStatusChange(item, "active")}>
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(item)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
