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

function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

export function BatchesTable({
  batches,
  canDelete,
  canEdit,
  canRecordWastage,
  onDelete,
  onEdit,
  onWastage,
}: {
  batches: ProductionBatch[];
  canDelete: boolean;
  canEdit: boolean;
  canRecordWastage: boolean;
  onDelete: (batch: ProductionBatch) => void;
  onEdit: (batch: ProductionBatch) => void;
  onWastage: (batch: ProductionBatch) => void;
}): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader className="bg-neutral-100">
        <TableRow className="border-neutral-300 hover:bg-neutral-100">
          <TableHead className="h-14 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Production Number
          </TableHead>
          <TableHead className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Output Product
          </TableHead>
          <TableHead className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Recipe
          </TableHead>
          <TableHead className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Planned
          </TableHead>
          <TableHead className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Produced
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Start Time
          </TableHead>
          <TableHead className="text-right text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
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
            <TableRow className="border-neutral-200 hover:bg-neutral-50" key={batch.id}>
              <TableCell>
                <Link
                  className="font-mono text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
                  href={`${ROUTES.manufacturingBatches}/${batch.id}`}
                >
                  {batch.batchNumber}
                </Link>
              </TableCell>
              <TableCell>
                <div className="grid gap-1">
                  <span className="font-semibold text-neutral-950">{batchOutputLabel(batch)}</span>
                  <span className="text-xs text-neutral-500">
                    Output: {batch.productVariantName ? "Variant stock" : "Parent product stock"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-neutral-700">
                {batch.recipeName} v{batch.recipeVersionNumber}
              </TableCell>
              <TableCell className="font-mono text-neutral-950">
                {formatQuantity(batch.plannedQuantity, batch.batchUnitName)}
              </TableCell>
              <TableCell className="min-w-44">
                <div className="space-y-2">
                  <span className="font-mono text-neutral-950">
                    {formatQuantity(batch.producedQuantity, batch.batchUnitName)}
                  </span>
                  <div className="h-1.5 rounded-full bg-neutral-200">
                    <div
                      className="h-1.5 rounded-full bg-neutral-950"
                      style={{ width: `${progress.toFixed(0)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <BatchStatusBadge status={batch.status} />
              </TableCell>
              <TableCell className="text-sm text-neutral-600">
                {formatDateTime(batch.startTime)}
              </TableCell>
              <TableCell className="text-right">
                <BatchActionsMenu
                  batch={batch}
                  canDelete={canDelete}
                  canEdit={canEdit}
                  canRecordWastage={canRecordWastage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onView={(selectedBatch) =>
                    router.push(`${ROUTES.manufacturingBatches}/${selectedBatch.id}`)
                  }
                  onWastage={onWastage}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
