"use client";

import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { BatchHeader } from "@/components/manufacturing/batch-header";
import { BatchIngredientConsumeDialog } from "@/components/manufacturing/batch-ingredient-consume-dialog";
import { BatchIngredientsSection } from "@/components/manufacturing/batch-ingredients-section";
import { BatchOutputSection } from "@/components/manufacturing/batch-output-section";
import { BatchPackagingSection } from "@/components/manufacturing/batch-packaging-section";
import { BatchProduceDialog } from "@/components/manufacturing/batch-produce-dialog";
import { BatchProgressCard } from "@/components/manufacturing/batch-progress-card";
import { BatchTimeline } from "@/components/manufacturing/batch-timeline";
import { BatchWastageDialog } from "@/components/manufacturing/batch-wastage-dialog";
import { BatchWastageSection } from "@/components/manufacturing/batch-wastage-section";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingTableSkeleton } from "@/components/manufacturing/manufacturing-table-skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import {
  useAddBatchWastage,
  useBatch,
  useBatchIngredients,
  useBatchOutputs,
  useBatchPackaging,
  useBatchWastage,
  useCancelBatch,
  useCompleteBatch,
  useConsumeBatch,
  useManufacturingInventory,
  useProduceBatch,
  useStartBatch,
} from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { ConsumePayload, ProducePayload, WastagePayload } from "@/types/manufacturing";

export function BatchDetailsPageClient({ batchId }: { batchId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.manufacturingBatchesEdit,
    PERMISSIONS.manufacturingBatchesStart,
    PERMISSIONS.manufacturingBatchesConsume,
    PERMISSIONS.manufacturingBatchesProduce,
    PERMISSIONS.manufacturingBatchesWastage,
    PERMISSIONS.manufacturingBatchesComplete,
    PERMISSIONS.manufacturingBatchesCancel,
  ]);
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [produceOpen, setProduceOpen] = useState(false);
  const [wastageOpen, setWastageOpen] = useState(false);
  const batchQuery = useBatch(batchId, canView);
  const ingredientsQuery = useBatchIngredients(batchId, canView);
  const packagingQuery = useBatchPackaging(batchId, canView);
  const outputsQuery = useBatchOutputs(batchId, canView);
  const wastageQuery = useBatchWastage(batchId, canView);
  const inventoryQuery = useManufacturingInventory(canView);
  const startMutation = useStartBatch();
  const completeMutation = useCompleteBatch();
  const cancelMutation = useCancelBatch();
  const consumeMutation = useConsumeBatch();
  const produceMutation = useProduceBatch();
  const wastageMutation = useAddBatchWastage();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (batchQuery.isLoading) {
    return <ManufacturingTableSkeleton />;
  }

  if (batchQuery.error || !batchQuery.data) {
    return (
      <ManufacturingErrorState
        description={batchQuery.error ? getErrorMessage(batchQuery.error) : "Batch not found."}
        onRetry={() => {
          void batchQuery.refetch();
        }}
      />
    );
  }

  const batch = batchQuery.data;

  const runLifecycle = async (action: "start" | "complete" | "cancel"): Promise<void> => {
    try {
      if (action === "start") await startMutation.mutateAsync(batch.id);
      if (action === "complete") await completeMutation.mutateAsync(batch.id);
      if (action === "cancel") await cancelMutation.mutateAsync(batch.id);
      toast.success("Batch updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleConsume = async (payload: ConsumePayload): Promise<void> => {
    try {
      await consumeMutation.mutateAsync({ id: batch.id, payload });
      toast.success("Ingredients consumed.");
      setConsumeOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleProduce = async (payload: ProducePayload): Promise<void> => {
    try {
      await produceMutation.mutateAsync({ id: batch.id, payload });
      toast.success("Production output recorded.");
      setProduceOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleWastage = async (payload: WastagePayload): Promise<void> => {
    try {
      await wastageMutation.mutateAsync({ id: batch.id, payload });
      toast.success("Wastage recorded.");
      setWastageOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <BatchHeader
        batch={batch}
        canManage={canManage}
        onCancel={() => void runLifecycle("cancel")}
        onComplete={() => void runLifecycle("complete")}
        onStart={() => void runLifecycle("start")}
      />

      <BatchProgressCard batch={batch} />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="space-y-6">
          <BatchIngredientsSection
            canManage={canManage}
            ingredients={ingredientsQuery.data ?? []}
            onConsume={() => setConsumeOpen(true)}
          />
          <BatchPackagingSection packaging={packagingQuery.data ?? []} />
          <BatchOutputSection
            canManage={canManage}
            onProduce={() => setProduceOpen(true)}
            outputs={outputsQuery.data ?? []}
          />
        </div>
        <div className="space-y-6">
          <BatchWastageSection
            canManage={canManage}
            onAddWastage={() => setWastageOpen(true)}
            wastage={wastageQuery.data ?? []}
          />
          <BatchTimeline batch={batch} />
        </div>
      </div>

      <BatchIngredientConsumeDialog
        ingredients={ingredientsQuery.data ?? []}
        isSubmitting={consumeMutation.isPending}
        onClose={() => setConsumeOpen(false)}
        onConsume={handleConsume}
        open={consumeOpen}
      />
      <BatchProduceDialog
        isSubmitting={produceMutation.isPending}
        onClose={() => setProduceOpen(false)}
        onProduce={handleProduce}
        open={produceOpen}
      />
      <BatchWastageDialog
        inventory={inventoryQuery.data ?? []}
        isSubmitting={wastageMutation.isPending}
        onClose={() => setWastageOpen(false)}
        onWastage={handleWastage}
        open={wastageOpen}
      />
    </div>
  );
}
