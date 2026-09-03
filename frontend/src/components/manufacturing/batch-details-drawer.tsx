"use client";

import { ArrowUpRight, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import {
  type BatchDetailTabKey,
  DEFAULT_BATCH_DETAIL_TAB,
} from "@/components/manufacturing/batch-detail-tabs";
import { BatchDetailsPanel } from "@/components/manufacturing/batch-details-panel";
import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import {
  useBatchIngredients,
  useBatchOutputs,
  useBatchPackaging,
  useBatchWastage,
} from "@/hooks/use-manufacturing";
import { canProduceBatch, isBatchPlannedStatus } from "@/lib/manufacturing/batch-status";
import type { ProductionBatch } from "@/types/manufacturing";

type BatchDetailsDrawerProps = {
  batch: ProductionBatch | null;
  canDelete: boolean;
  canProduce: boolean;
  canRecordWastage: boolean;
  isProducing: boolean;
  /** Each of these closes the drawer first, then opens the host's dialog. */
  onDelete: (batch: ProductionBatch) => void;
  onOpenChange: (open: boolean) => void;
  onProduce: (batch: ProductionBatch) => void;
  onWastage: (batch: ProductionBatch) => void;
  open: boolean;
};

/**
 * A production batch, over the list.
 *
 * The tab state is in memory, not in the URL: a `router.replace` here would
 * remount the page segment about a second later and Radix would dismiss the
 * sheet. The full page is the URL-addressable copy, linked from the header.
 */
export function BatchDetailsDrawer({
  batch,
  canDelete,
  canProduce,
  canRecordWastage,
  isProducing,
  onDelete,
  onOpenChange,
  onProduce,
  onWastage,
  open,
}: BatchDetailsDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<BatchDetailTabKey>(DEFAULT_BATCH_DETAIL_TAB);
  const batchId = batch?.id ?? null;
  const enabled = open && batchId !== null;
  // Only the open drawer fetches, and only for the row it is showing.
  const ingredientsQuery = useBatchIngredients(batchId, enabled);
  const packagingQuery = useBatchPackaging(batchId, enabled);
  const outputsQuery = useBatchOutputs(batchId, enabled);
  const wastageQuery = useBatchWastage(batchId, enabled);

  const isPlanned = batch ? isBatchPlannedStatus(batch.status) : false;
  const showProduce = batch ? canProduce && canProduceBatch(batch) : false;
  const showWastage = batch
    ? canRecordWastage && !isPlanned && batch.status !== "cancelled"
    : false;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" side="right">
        {batch ? (
          // Keyed by batch: opening a different row resets the tab.
          <div className="grid min-w-0 gap-6" key={batch.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="font-mono text-section">{batch.batchNumber}</SheetTitle>
              <SheetDescription className="sr-only">
                Production batch progress, components, output and wastage.
              </SheetDescription>
              <p className="mt-1 text-meta text-foreground-muted">
                {batch.productName}
                {batch.productVariantName ? ` - ${batch.productVariantName}` : ""} ·{" "}
                {batch.branchName}
              </p>
              <div className="mt-2">
                <BatchStatusBadge status={batch.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="outline">
                  <Link href={`${ROUTES.manufacturingBatches}/${batch.id}`}>
                    <ArrowUpRight className="h-4 w-4" />
                    Open full page
                  </Link>
                </Button>
                {showProduce ? (
                  <Button
                    disabled={isProducing}
                    onClick={() => onProduce(batch)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Play className="h-4 w-4" />
                    {isProducing ? "Producing..." : "Produce planned"}
                  </Button>
                ) : null}
                {showWastage ? (
                  <Button
                    onClick={() => onWastage(batch)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Record wastage
                  </Button>
                ) : null}
                {canDelete && isPlanned ? (
                  <Button
                    className="text-danger-text"
                    onClick={() => onDelete(batch)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete planned
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <BatchDetailsPanel
              activeTab={activeTab}
              batch={batch}
              ingredients={ingredientsQuery.data ?? []}
              onTabChange={setActiveTab}
              outputs={outputsQuery.data ?? []}
              packaging={packagingQuery.data ?? []}
              wastage={wastageQuery.data ?? []}
            />
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Production batch</SheetTitle>
            <SheetDescription>No batch selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
