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
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchActionsMenu({
  batch,
  canDelete,
  canEdit,
  canProduce,
  canRecordWastage,
  onDelete,
  onEdit,
  onProduce,
  onView,
  onWastage,
}: {
  batch: ProductionBatch;
  canDelete: boolean;
  canEdit: boolean;
  canProduce: boolean;
  canRecordWastage: boolean;
  onDelete: (batch: ProductionBatch) => void;
  onEdit: (batch: ProductionBatch) => void;
  onProduce: (batch: ProductionBatch) => void;
  onView: (batch: ProductionBatch) => void;
  onWastage: (batch: ProductionBatch) => void;
}): JSX.Element {
  const isPlanned = batch.status === "draft";
  const canAddWastage =
    canRecordWastage && batch.status !== "draft" && batch.status !== "cancelled";

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
        {canEdit && isPlanned ? (
          <DropdownMenuItem onSelect={() => onEdit(batch)}>
            <Edit className="h-4 w-4" />
            Edit planned
          </DropdownMenuItem>
        ) : null}
        {canProduce && isPlanned ? (
          <DropdownMenuItem onSelect={() => onProduce(batch)}>
            <Play className="h-4 w-4" />
            Produce planned
          </DropdownMenuItem>
        ) : null}
        {canDelete && isPlanned ? (
          <DropdownMenuItem className="text-red-700" onSelect={() => onDelete(batch)}>
            <Trash2 className="h-4 w-4" />
            Delete planned
          </DropdownMenuItem>
        ) : null}
        {canAddWastage ? (
          <DropdownMenuItem onSelect={() => onWastage(batch)}>Record wastage</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
