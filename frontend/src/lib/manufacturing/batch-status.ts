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
