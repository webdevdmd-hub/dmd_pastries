"use client";

import { Eye, MoreHorizontal, Star, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReceiptLayout } from "@/types/settings";

export type ReceiptLayoutActionHandlers = {
  canManage: boolean;
  onDelete: (layout: ReceiptLayout) => void;
  onEdit: (layout: ReceiptLayout) => void;
  onPreview: (layout: ReceiptLayout) => void;
  onSetDefault: (layout: ReceiptLayout) => void;
};

/**
 * Preview is available to anyone who can see the list; the rest needs manage
 * rights. Items that cannot apply -- setting the default as default -- are
 * absent rather than present and greyed.
 */
export function ReceiptLayoutActionsMenu({
  canManage,
  layout,
  onDelete,
  onEdit,
  onPreview,
  onSetDefault,
}: ReceiptLayoutActionHandlers & { layout: ReceiptLayout }): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${layout.layoutName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onPreview(layout)}>
          <Eye className="mr-2 h-4 w-4" />
          Print preview
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEdit(layout)}>Edit layout</DropdownMenuItem>
            {layout.isDefault ? null : (
              <DropdownMenuItem onSelect={() => onSetDefault(layout)}>
                <Star className="mr-2 h-4 w-4" />
                Set as default
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger-text focus:text-danger-text"
              onSelect={() => onDelete(layout)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete layout
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
