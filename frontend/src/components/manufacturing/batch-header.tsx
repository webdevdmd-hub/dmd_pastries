"use client";

import Link from "next/link";
import type { JSX } from "react";

import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { canProduceBatch, isBatchPlannedStatus } from "@/lib/manufacturing/batch-status";
import { formatRecipeVersionLabel } from "@/lib/manufacturing/recipe-version-display";
import type { ProductionBatch } from "@/types/manufacturing";

function batchOutputLabel(batch: ProductionBatch): string {
  return batch.productVariantName
    ? `${batch.productName} - ${batch.productVariantName}`
    : batch.productName;
}

export function BatchHeader({
  batch,
  canProduce = false,
  canRecordWastage = false,
  isProducing = false,
  onProduce,
  onRecordWastage,
}: {
  batch: ProductionBatch;
  canProduce?: boolean;
  canRecordWastage?: boolean;
  isProducing?: boolean;
  onProduce?: () => void;
  onRecordWastage?: () => void;
}): JSX.Element {
  const canShowWastageAction =
    canRecordWastage && !isBatchPlannedStatus(batch.status) && batch.status !== "cancelled";
  const canShowProduceAction = canProduce && canProduceBatch(batch);

  return (
    <div className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link
          className="text-sm font-semibold text-foreground-muted hover:text-foreground"
          href={ROUTES.manufacturingBatches}
        >
          Manufacturing / Production Detail
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Production {batch.batchNumber}
          </h1>
          <BatchStatusBadge status={batch.status} />
        </div>
        <div className="mt-3 grid gap-2 text-sm text-foreground-muted">
          <p>
            Recipe:{" "}
            <span className="font-semibold text-foreground">
              {batch.recipeName} · {formatRecipeVersionLabel(batch.recipeVersionNumber)}
            </span>
          </p>
          <p>
            Output: <span className="font-semibold text-foreground">{batchOutputLabel(batch)}</span>
          </p>
          <p>
            Branch: <span className="font-semibold text-foreground">{batch.branchName}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {canShowProduceAction ? (
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary"
            disabled={isProducing}
            onClick={onProduce}
            type="button"
          >
            {isProducing ? "Producing..." : "Produce planned"}
          </Button>
        ) : null}
        {canShowWastageAction ? (
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary"
            onClick={onRecordWastage}
            type="button"
          >
            Record Wastage
          </Button>
        ) : null}
      </div>
    </div>
  );
}
