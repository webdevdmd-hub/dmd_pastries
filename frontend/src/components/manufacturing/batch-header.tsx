"use client";

import Link from "next/link";
import type { JSX } from "react";

import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchHeader({
  batch,
  canManage,
  onCancel,
  onComplete,
  onStart,
}: {
  batch: ProductionBatch;
  canManage: boolean;
  onCancel: () => void;
  onComplete: () => void;
  onStart: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.manufacturingBatches}
        >
          Back to Batches
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{batch.batchNumber}</h1>
          <BatchStatusBadge status={batch.status} />
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {batch.productName} · {batch.recipeName} v{batch.recipeVersionNumber}
        </p>
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={batch.status !== "draft"} onClick={onStart} type="button">
            Start
          </Button>
          <Button
            disabled={batch.status !== "in_progress" && batch.status !== "partially_completed"}
            onClick={onComplete}
            type="button"
            variant="outline"
          >
            Complete
          </Button>
          <Button
            disabled={batch.status === "completed" || batch.status === "cancelled"}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
