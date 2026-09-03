"use client";

import { Edit, MoreHorizontal, Play, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canProduceBatch, isBatchPlannedStatus } from "@/lib/manufacturing/batch-status";
import type { ProductionBatch } from "@/types/manufacturing";

export type BatchActionHandlers = {
  canDelete: boolean;
  canEdit: boolean;
  canProduce: boolean;
  canRecordWastage: boolean;
  onDelete: (batch: ProductionBatch) => void;
  onEdit: (batch: ProductionBatch) => void;
  onProduce: (batch: ProductionBatch) => void;
  onWastage: (batch: ProductionBatch) => void;
  producingBatchId?: string | null;
};

/**
 * Actions only. "View details" is gone: the row opens the drawer, and the
 * drawer header carries the full-page link. A batch whose status leaves no
 * action available renders no menu rather than an empty one.
 */
export function BatchActionsMenu({
  batch,
  canDelete,
  canEdit,
  canProduce,
  canRecordWastage,
  onDelete,
  onEdit,
  onProduce,
  onWastage,
  producingBatchId = null,
}: BatchActionHandlers & { batch: ProductionBatch }): JSX.Element | null {
  const isPlanned = isBatchPlannedStatus(batch.status);
  const isProducing = producingBatchId === batch.id;
  const showEdit = canEdit && isPlanned;
  const showProduce = canProduce && canProduceBatch(batch);
  const showDelete = canDelete && isPlanned;
  const showWastage = canRecordWastage && !isPlanned && batch.status !== "cancelled";

  // A completed batch that the viewer cannot waste against has nothing here,
  // and an empty dropdown is worse than no dropdown.
  if (!showEdit && !showProduce && !showDelete && !showWastage) {
    return null;
  }

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
        {showEdit ? (
          <DropdownMenuItem onSelect={() => onEdit(batch)}>
            <Edit className="h-4 w-4" />
            Edit planned
          </DropdownMenuItem>
        ) : null}
        {showProduce ? (
          <DropdownMenuItem disabled={isProducing} onSelect={() => onProduce(batch)}>
            <Play className="h-4 w-4" />
            {isProducing ? "Producing..." : "Produce planned"}
          </DropdownMenuItem>
        ) : null}
        {showWastage ? (
          <DropdownMenuItem onSelect={() => onWastage(batch)}>Record wastage</DropdownMenuItem>
        ) : null}
        {showDelete ? (
          <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(batch)}>
            <Trash2 className="h-4 w-4" />
            Delete planned
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
