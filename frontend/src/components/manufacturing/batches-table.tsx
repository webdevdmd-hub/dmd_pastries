"use client";

import type { JSX } from "react";

import {
  type BatchActionHandlers,
  BatchActionsMenu,
} from "@/components/manufacturing/batch-actions-menu";
import {
  batchOutputLabel,
  formatBatchDateTime,
  formatBatchQuantity,
} from "@/components/manufacturing/batch-details-panel";
import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRecipeVersionLabel } from "@/lib/manufacturing/recipe-version-display";
import type { ProductionBatch } from "@/types/manufacturing";

export type BatchesListProps = BatchActionHandlers & {
  batches: ProductionBatch[];
  /** Opens the batch's details; the whole row is the target. */
  onView: (batch: ProductionBatch) => void;
};

export function batchProgressPercent(batch: ProductionBatch): number {
  return batch.plannedQuantity > 0
    ? Math.min((batch.producedQuantity / batch.plannedQuantity) * 100, 100)
    : 0;
}

/**
 * Eight columns became six.
 *
 * Planned and Produced were two number columns describing one quantity, so
 * they share a cell reading `12 / 20 pcs` above the progress bar that was
 * already there. The "Output: parent product stock" line under every product
 * name went to the drawer, where it is a labelled field rather than a sentence
 * repeated down a column. The inline "Produce planned" button left the row too:
 * it posts stock and accounting in one transaction, which is not something to
 * put one stray click away in a dense list.
 */
export function BatchesTable({ batches, onView, ...actions }: BatchesListProps): JSX.Element {
  return (
    <Table>
      <TableHeader className="bg-muted">
        <TableRow className="border-border hover:bg-muted">
          <TableHead>Production</TableHead>
          <TableHead>Output product</TableHead>
          <TableHead>Recipe</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Start time</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => (
          // The row opens the drawer; the number is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow
            className="cursor-pointer border-border hover:bg-muted"
            key={batch.id}
            onClick={() => onView(batch)}
          >
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(batch);
                }}
                type="button"
              >
                <span className="font-mono font-medium">{batch.batchNumber}</span>
                <span className="text-meta text-foreground-muted">{batch.branchName}</span>
              </button>
            </TableCell>
            <TableCell>{batchOutputLabel(batch)}</TableCell>
            <TableCell className="text-foreground-muted">
              {batch.recipeName} · {formatRecipeVersionLabel(batch.recipeVersionNumber)}
            </TableCell>
            <TableCell className="min-w-44 whitespace-normal">
              <div className="space-y-2">
                <span className="text-cell tabular-nums">
                  {formatBatchQuantity(batch.producedQuantity, "")}/{" "}
                  {formatBatchQuantity(batch.plannedQuantity, batch.batchUnitName)}
                </span>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${batchProgressPercent(batch).toFixed(0)}%` }}
                  />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <BatchStatusBadge status={batch.status} />
            </TableCell>
            <TableCell className="tabular-nums text-foreground-muted">
              {formatBatchDateTime(batch.startTime)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <BatchActionsMenu {...actions} batch={batch} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
