"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { BatchActionsMenu } from "@/components/manufacturing/batch-actions-menu";
import { BatchStatusBadge } from "@/components/manufacturing/batch-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
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

export function BatchesTable({
  batches,
  canManage,
  onCancel,
  onComplete,
  onDelete,
  onEdit,
  onStart,
}: {
  batches: ProductionBatch[];
  canManage: boolean;
  onCancel: (batch: ProductionBatch) => void;
  onComplete: (batch: ProductionBatch) => void;
  onDelete: (batch: ProductionBatch) => void;
  onEdit: (batch: ProductionBatch) => void;
  onStart: (batch: ProductionBatch) => void;
}): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch Number</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Recipe</TableHead>
          <TableHead>Planned Qty</TableHead>
          <TableHead>Produced Qty</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Start Time</TableHead>
          <TableHead>End Time</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => (
          <TableRow key={batch.id}>
            <TableCell>
              <Link
                className="font-semibold text-brand-espresso"
                href={`${ROUTES.manufacturingBatches}/${batch.id}`}
              >
                {batch.batchNumber}
              </Link>
            </TableCell>
            <TableCell>
              <div className="grid gap-1">
                <span>{batchOutputLabel(batch)}</span>
                <span className="text-xs text-brand-mocha">
                  Output: {batch.productVariantName ? "Variant stock" : "Parent product stock"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {batch.recipeName} v{batch.recipeVersionNumber}
            </TableCell>
            <TableCell>
              {batch.plannedQuantity} {batch.batchUnitName}
            </TableCell>
            <TableCell>
              {batch.producedQuantity} {batch.batchUnitName}
            </TableCell>
            <TableCell>
              <BatchStatusBadge status={batch.status} />
            </TableCell>
            <TableCell>{formatDateTime(batch.startTime)}</TableCell>
            <TableCell>{formatDateTime(batch.endTime)}</TableCell>
            <TableCell>
              <BatchActionsMenu
                batch={batch}
                canManage={canManage}
                onCancel={onCancel}
                onComplete={onComplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onStart={onStart}
                onView={(selectedBatch) =>
                  router.push(`${ROUTES.manufacturingBatches}/${selectedBatch.id}`)
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
