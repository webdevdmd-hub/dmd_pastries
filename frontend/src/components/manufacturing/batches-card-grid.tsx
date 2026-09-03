"use client";

import type { JSX } from "react";

import { BatchActionsMenu } from "@/components/manufacturing/batch-actions-menu";
import {
  batchOutputLabel,
  formatBatchDateTime,
  formatBatchQuantity,
} from "@/components/manufacturing/batch-details-panel";
import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import {
  type BatchesListProps,
  batchProgressPercent,
} from "@/components/manufacturing/batches-table";
import { Card } from "@/components/ui/card";
import { formatRecipeVersionLabel } from "@/lib/manufacturing/recipe-version-display";

/** The production list as cards, for phones. */
export function BatchesCardGrid({ batches, onView, ...actions }: BatchesListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {batches.map((batch) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={batch.id}
          onClick={() => onView(batch)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(batch);
              }}
              type="button"
            >
              <span className="truncate font-mono font-medium">{batch.batchNumber}</span>
              <span className="truncate text-meta text-foreground-muted">
                {batchOutputLabel(batch)}
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <BatchActionsMenu {...actions} batch={batch} />
            </div>
          </div>

          <div className="grid gap-2 px-4 py-3">
            <BatchStatusBadge status={batch.status} />
            <p className="text-cell text-foreground-muted">
              {batch.recipeName} · {formatRecipeVersionLabel(batch.recipeVersionNumber)}
            </p>
          </div>

          <div className="border-t border-workspace-border bg-brand-latte/30 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-meta text-foreground-muted">Progress</p>
              <p className="text-cell font-medium tabular-nums">
                {formatBatchQuantity(batch.producedQuantity, "")}/{" "}
                {formatBatchQuantity(batch.plannedQuantity, batch.batchUnitName)}
              </p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${batchProgressPercent(batch).toFixed(0)}%` }}
              />
            </div>
          </div>

          <p className="border-t border-workspace-border px-4 py-2 text-meta tabular-nums text-foreground-muted">
            {formatBatchDateTime(batch.startTime)} · {batch.branchName}
          </p>
        </Card>
      ))}
    </div>
  );
}
