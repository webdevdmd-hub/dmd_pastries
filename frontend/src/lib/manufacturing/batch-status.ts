import type { BatchStatus, ProductionBatch } from "@/types/manufacturing";

export function isBatchProduceEligible(status: BatchStatus): boolean {
  return status === "draft" || status === "planned" || status === "in_progress";
}

export function isBatchPlannedStatus(status: BatchStatus): boolean {
  return status === "draft" || status === "planned";
}

export function canProduceBatch(batch: ProductionBatch): boolean {
  return isBatchProduceEligible(batch.status) && batch.producedQuantity <= 0;
}

/** Finished goods from a batch that can still be written off. */
export function batchWastageRemaining(
  batch: Pick<ProductionBatch, "producedQuantity" | "wastageQuantity">,
): number {
  const remaining = Math.round((batch.producedQuantity - batch.wastageQuantity) * 10000) / 10000;
  return remaining > 0 ? remaining : 0;
}

/**
 * Wastage writes off finished goods, so it needs a produced batch with output
 * left. It used to be offered on every non-planned batch -- in practice only
 * completed ones -- while the server accepted only planned and in-progress
 * batches, so it could never succeed. (ISSUE-044)
 */
export function canRecordBatchWastage(
  batch: Pick<ProductionBatch, "status" | "producedQuantity" | "wastageQuantity">,
): boolean {
  return batch.status === "completed" && batchWastageRemaining(batch) > 0;
}
