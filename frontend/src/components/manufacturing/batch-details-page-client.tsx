"use client";

import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { BatchHeader } from "@/components/manufacturing/batch-header";
import { BatchIngredientsSection } from "@/components/manufacturing/batch-ingredients-section";
import { BatchOutputSection } from "@/components/manufacturing/batch-output-section";
import { BatchPackagingSection } from "@/components/manufacturing/batch-packaging-section";
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
  useManufacturingInventory,
  useProduceBatch,
} from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { canProduceBatch } from "@/lib/manufacturing/batch-status";
import { productionFailureMessage } from "@/lib/manufacturing/production-errors";
import type { WastagePayload } from "@/types/manufacturing";

export function BatchDetailsPageClient({ batchId }: { batchId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const [wastageOpen, setWastageOpen] = useState(false);
  const canView = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.inventoryView]);
  const canProduce = hasAnyPermission([PERMISSIONS.manufacturingBatchesProduce]);
  const canRecordWastage = hasAnyPermission([PERMISSIONS.manufacturingBatchesWastage]);
  const batchQuery = useBatch(batchId, canView);
  const ingredientsQuery = useBatchIngredients(batchId, canView);
  const packagingQuery = useBatchPackaging(batchId, canView);
  const outputsQuery = useBatchOutputs(batchId, canView);
  const wastageQuery = useBatchWastage(batchId, canView);
  const inventoryQuery = useManufacturingInventory(canView && canRecordWastage);
  const addWastageMutation = useAddBatchWastage();
  const produceBatchMutation = useProduceBatch();

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

  const handleProducePlanned = async (): Promise<void> => {
    if (!canProduceBatch(batch)) {
      toast.error("Only planned, draft, or in-progress batches without output can be produced.");
      return;
    }

    try {
      await produceBatchMutation.mutateAsync({
        id: batch.id,
        payload: {
          ...(batch.productionDate ? { productionDate: batch.productionDate.slice(0, 10) } : {}),
          ...(batch.notes ? { notes: batch.notes } : {}),
          quantityProduced: batch.plannedQuantity,
        },
      });
      toast.success("Planned production produced.");
    } catch (error) {
      toast.error(productionFailureMessage(error));
    }
  };

  const handleWastage = async (payload: WastagePayload): Promise<void> => {
    try {
      await addWastageMutation.mutateAsync({ id: batch.id, payload });
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
        canProduce={canProduce}
        canRecordWastage={canRecordWastage}
        isProducing={produceBatchMutation.isPending}
        onProduce={() => {
          void handleProducePlanned();
        }}
        onRecordWastage={() => setWastageOpen(true)}
      />

      <BatchProgressCard batch={batch} />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.48fr]">
        <div className="space-y-6">
          <BatchIngredientsSection ingredients={ingredientsQuery.data ?? []} />
          <BatchPackagingSection packaging={packagingQuery.data ?? []} />
          <BatchOutputSection outputs={outputsQuery.data ?? []} />
        </div>
        <div className="space-y-6">
          <BatchWastageSection wastage={wastageQuery.data ?? []} />
          <BatchTimeline batch={batch} />
        </div>
      </div>

      <BatchWastageDialog
        inventory={inventoryQuery.data ?? []}
        isSubmitting={addWastageMutation.isPending}
        onClose={() => setWastageOpen(false)}
        onWastage={handleWastage}
        open={wastageOpen}
      />
    </div>
  );
}
