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
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchActionsMenu({
  batch,
  canManage,
  onCancel,
  onComplete,
  onDelete,
  onEdit,
  onStart,
  onView,
}: {
  batch: ProductionBatch;
  canManage: boolean;
  onCancel: (batch: ProductionBatch) => void;
  onComplete: (batch: ProductionBatch) => void;
  onDelete: (batch: ProductionBatch) => void;
  onEdit: (batch: ProductionBatch) => void;
  onStart: (batch: ProductionBatch) => void;
  onView: (batch: ProductionBatch) => void;
}): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${batch.batchNumber}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onView(batch)}>View details</DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem disabled={batch.status !== "draft"} onSelect={() => onEdit(batch)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem disabled={batch.status !== "draft"} onSelect={() => onStart(batch)}>
              Start
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={batch.status !== "in_progress" && batch.status !== "partially_completed"}
              onSelect={() => onComplete(batch)}
            >
              Complete
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={batch.status === "completed" || batch.status === "cancelled"}
              onSelect={() => onCancel(batch)}
            >
              Cancel
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-700" onSelect={() => onDelete(batch)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
