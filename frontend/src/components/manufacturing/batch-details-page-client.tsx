"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import {
  type BatchDetailTabKey,
  parseBatchDetailTab,
} from "@/components/manufacturing/batch-detail-tabs";
import { BatchDetailsPanel } from "@/components/manufacturing/batch-details-panel";
import { BatchHeader } from "@/components/manufacturing/batch-header";
import { BatchWastageDialog } from "@/components/manufacturing/batch-wastage-dialog";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingTableSkeleton } from "@/components/manufacturing/manufacturing-table-skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const batchQuery = useBatch(batchId, canView);
  const ingredientsQuery = useBatchIngredients(batchId, canView);
  const packagingQuery = useBatchPackaging(batchId, canView);
  const outputsQuery = useBatchOutputs(batchId, canView);
  const wastageQuery = useBatchWastage(batchId, canView);
  const inventoryQuery = useManufacturingInventory(canView && canRecordWastage);
  const addWastageMutation = useAddBatchWastage();
  const produceBatchMutation = useProduceBatch();

  const activeTab = parseBatchDetailTab(searchParams.get("tab"));

  const changeTab = (tab: BatchDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
        href={ROUTES.manufacturingBatches}
      >
        Back to production
      </Link>

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

      <BatchDetailsPanel
        activeTab={activeTab}
        batch={batch}
        ingredients={ingredientsQuery.data ?? []}
        onTabChange={changeTab}
        outputs={outputsQuery.data ?? []}
        packaging={packagingQuery.data ?? []}
        wastage={wastageQuery.data ?? []}
      />

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
