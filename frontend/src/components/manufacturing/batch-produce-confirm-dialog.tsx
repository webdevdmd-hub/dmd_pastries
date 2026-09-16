"use client";

import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProductionPreview } from "@/hooks/use-manufacturing";
import { producePlannedBlocked } from "@/lib/manufacturing/batch-status";
import type { ProductionBatch } from "@/types/manufacturing";

function formatQuantity(value: number, unit = ""): string {
  const formatted = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

/**
 * The review step before a planned batch is produced. Producing consumes its
 * components, adds the output to stock and posts the journal, and a completed
 * batch cannot be cancelled or deleted -- yet "Produce planned" in the row
 * menu, the drawer and the batch page did all of that on a single click.
 * (ISSUE-046)
 */
export function BatchProduceConfirmDialog({
  batch,
  isProducing,
  onClose,
  onConfirm,
}: {
  batch: ProductionBatch | null;
  isProducing: boolean;
  onClose: () => void;
  onConfirm: (batch: ProductionBatch) => void;
}): JSX.Element {
  const previewQuery = useProductionPreview(
    {
      branchId: batch?.branchId ?? "",
      quantity: batch?.plannedQuantity ?? 0,
      recipeId: batch?.recipeId ?? "",
    },
    batch !== null,
  );
  const preview = previewQuery.data;
  const lines = preview ? [...preview.components, ...preview.packaging] : [];
  const blocked = producePlannedBlocked({
    isError: previewQuery.isError,
    isLoading: previewQuery.isLoading,
    isProducing,
    preview,
  });
  const productName = batch
    ? `${batch.productName}${batch.productVariantName ? ` - ${batch.productVariantName}` : ""}`
    : "";

  return (
    <Dialog open={batch !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b border-border px-7 py-6">
          <DialogTitle>Produce {batch?.batchNumber}?</DialogTitle>
          <DialogDescription>
            Makes {formatQuantity(batch?.plannedQuantity ?? 0, batch?.batchUnitName)} of{" "}
            {productName}. The components below leave stock and the accounting is posted. A produced
            batch cannot be cancelled or deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-7 py-6">
          {previewQuery.isLoading ? (
            <p className="text-cell text-foreground-muted">Checking stock and cost...</p>
          ) : null}
          {previewQuery.isError ? (
            <Alert className="border-danger/30 bg-danger-tint text-danger-text">
              <AlertTitle>Could not check this batch</AlertTitle>
              <AlertDescription>Close this and try again.</AlertDescription>
            </Alert>
          ) : null}
          {preview ? (
            <>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {lines.map((line) => (
                  <li
                    className="flex items-center justify-between gap-3 px-3 py-2 text-cell"
                    key={line.recipeLineId}
                  >
                    <span className="text-foreground">{line.productName}</span>
                    <span className="tabular-nums text-foreground-muted">
                      {formatQuantity(line.requiredQuantity, line.unit)} ·{" "}
                      {formatMoney(line.estimatedTotalCost)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-cell text-foreground tabular-nums">
                Estimated cost {formatMoney(preview.estimatedTotalCost)}
              </p>
              {preview.hasShortage ? (
                <Alert className="border-danger/30 bg-danger-tint text-danger-text">
                  <AlertTitle>Not enough stock to produce</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-5">
                      {preview.shortages.map((shortage) => (
                        <li key={shortage.recipeLineId}>
                          {shortage.productName}: short{" "}
                          {formatQuantity(shortage.shortageQuantity, shortage.unit)}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}
        </div>
        <DialogFooter className="border-t border-border bg-muted px-7 py-5">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={blocked}
            onClick={() => (batch ? onConfirm(batch) : undefined)}
            type="button"
          >
            {isProducing ? "Producing..." : "Produce"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
