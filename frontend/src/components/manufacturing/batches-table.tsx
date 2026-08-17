"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { BatchActionsMenu } from "@/components/manufacturing/batch-actions-menu";
import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { canProduceBatch } from "@/lib/manufacturing/batch-status";
import { formatRecipeVersionLabel } from "@/lib/manufacturing/recipe-version-display";
import type { ProductionBatch } from "@/types/manufacturing";

function formatDateTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not set";
}

function batchOutputLabel(batch: ProductionBatch): string {
  return batch.productVariantName
    ? `${batch.productName} - ${batch.productVariantName}`
    : batch.productName;
}

function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

export function BatchesTable({
  batches,
  canDelete,
  canEdit,
  canProduce,
  canRecordWastage,
  producingBatchId = null,
  onDelete,
  onEdit,
  onProduce,
  onWastage,
}: {
  batches: ProductionBatch[];
  canDelete: boolean;
  canEdit: boolean;
  canProduce: boolean;
  canRecordWastage: boolean;
  producingBatchId?: string | null;
  onDelete: (batch: ProductionBatch) => void;
  onEdit: (batch: ProductionBatch) => void;
  onProduce: (batch: ProductionBatch) => void;
  onWastage: (batch: ProductionBatch) => void;
}): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader className="bg-muted">
        <TableRow className="border-border hover:bg-muted">
          <TableHead className="h-14 text-xs font-bold text-foreground-muted">
            Production Number
          </TableHead>
          <TableHead className="text-xs font-bold text-foreground-muted">Output Product</TableHead>
          <TableHead className="text-xs font-bold text-foreground-muted">Recipe</TableHead>
          <TableHead className="text-xs font-bold text-foreground-muted">Planned</TableHead>
          <TableHead className="text-xs font-bold text-foreground-muted">Produced</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-xs font-bold text-foreground-muted">Start Time</TableHead>
          <TableHead className="text-right text-xs font-bold text-foreground-muted">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => {
          const progress =
            batch.plannedQuantity > 0
              ? Math.min((batch.producedQuantity / batch.plannedQuantity) * 100, 100)
              : 0;

          return (
            <TableRow className="border-border hover:bg-muted" key={batch.id}>
              <TableCell>
                <Link
                  className="font-mono text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  href={`${ROUTES.manufacturingBatches}/${batch.id}`}
                >
                  {batch.batchNumber}
                </Link>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-semibold text-foreground">{batchOutputLabel(batch)}</span>
                  <span className="text-xs text-foreground-muted">
                    Output: {batch.productVariantName ? "Variant stock" : "Parent product stock"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-foreground-muted">
                {batch.recipeName} · {formatRecipeVersionLabel(batch.recipeVersionNumber)}
              </TableCell>
              <TableCell className="font-mono text-foreground">
                {formatQuantity(batch.plannedQuantity, batch.batchUnitName)}
              </TableCell>
              <TableCell className="min-w-44">
                <div className="space-y-2">
                  <span className="font-mono text-foreground">
                    {formatQuantity(batch.producedQuantity, batch.batchUnitName)}
                  </span>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${progress.toFixed(0)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <BatchStatusBadge status={batch.status} />
              </TableCell>
              <TableCell className="text-sm text-foreground-muted">
                {formatDateTime(batch.startTime)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {canProduce && canProduceBatch(batch) ? (
                    <Button
                      className="h-8 border-border px-3 text-xs"
                      disabled={producingBatchId === batch.id}
                      onClick={() => onProduce(batch)}
                      type="button"
                      variant="outline"
                    >
                      {producingBatchId === batch.id ? "Producing..." : "Produce planned"}
                    </Button>
                  ) : null}
                  <BatchActionsMenu
                    batch={batch}
                    canDelete={canDelete}
                    canEdit={canEdit}
                    canProduce={canProduce}
                    canRecordWastage={canRecordWastage}
                    isProducing={producingBatchId === batch.id}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onProduce={onProduce}
                    onView={(selectedBatch) =>
                      router.push(`${ROUTES.manufacturingBatches}/${selectedBatch.id}`)
                    }
                    onWastage={onWastage}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
