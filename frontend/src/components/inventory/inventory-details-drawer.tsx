"use client";

import { History, PackagePlus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { ExpiryBatchesSection } from "@/components/inventory/expiry-batches-section";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { StockMovementsTable } from "@/components/inventory/stock-movements-table";
import { ReorderLevelHelpIcon } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ExpiryBatch,
  ExpiryBatchStatus,
  InventoryItem,
  StockMovement,
} from "@/types/inventory";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

type InventoryDetailsDrawerProps = {
  batches: ExpiryBatch[];
  canManage: boolean;
  item: InventoryItem | null;
  movements: StockMovement[];
  onAddBatch: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  onBatchStatusChange: (batchId: string, status: ExpiryBatchStatus) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  batchesLoading: boolean;
  movementsLoading: boolean;
  /**
   * Whether the batch affordances (add a batch, change a batch's status) are
   * live. False on surfaces that show the drawer for reading but do not wire
   * the batch mutations -- the batches stay visible, they just are not
   * editable, which beats rendering controls that call a no-op.
   */
  showBatchActions?: boolean;
};

function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

/** The structural kind of the row, previously the list's "Type" column. */
function typeLabel(value: InventoryItem["itemType"]): string {
  if (value === "product") return "Product Master";
  if (value === "product_variant") return "Product Variant";
  if (value === "ingredient") return "Legacy Ingredient";
  return "Legacy Packaging";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function InventoryDetailsDrawer({
  batches,
  batchesLoading,
  canManage,
  item,
  movements,
  movementsLoading,
  onAddBatch,
  onAdjust,
  onBatchStatusChange,
  onOpenChange,
  open,
  showBatchActions = true,
}: InventoryDetailsDrawerProps): JSX.Element {
  const canManageBatches = canManage && showBatchActions;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" side="right">
        <SheetHeader>
          <SheetTitle>{item?.itemName ?? "Inventory item"}</SheetTitle>
          {/* Branch moved here from its own card. It is context for everything
              below rather than a measurement, so it belongs beside the name.
              Kept as SheetDescription rather than a plain <p>: Radix warns when
              a Dialog has no Description, and this preserves aria-describedby. */}
          <SheetDescription>
            {item
              ? `${item.branchName} · ${item.isExpiryTracked ? "Expiry tracked" : "Not expiry tracked"}`
              : "Branch stock, recent movements, and expiry batch visibility."}
          </SheetDescription>
          {item ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <InventoryStatusBadge status={item.status} />
              <StockLevelBadge item={item} />
            </div>
          ) : null}
        </SheetHeader>

        {item ? (
          <div className="mt-6 space-y-6">
            {/* Identity: what this row IS, separated from how it is doing. The
                code is an identifier, so DESIGN.md section 2 puts it in mono,
                left-aligned. The "No code" fallback is prose, not an
                identifier, so it deliberately stays in sans. */}
            <div className="rounded-2xl bg-muted p-4">
              {item.itemCode ? (
                <p className="font-mono text-cell text-foreground">{item.itemCode}</p>
              ) : (
                <p className="text-cell text-foreground-muted">No code</p>
              )}
              <p className="mt-1 text-meta text-foreground-muted">
                {[
                  typeLabel(item.itemType),
                  item.productType ? PRODUCT_TYPE_LABELS[item.productType] : null,
                  item.variantName ? `Variant: ${item.variantName}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            {/* Six measurements, one grid. Current, Available and Reserved sit
                together because Reserved is the difference between the other
                two and means little alone -- a relationship a 14-column list
                could never show even while displaying all three. */}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded bg-border">
              <div className="flex flex-col justify-center gap-0.5 bg-card px-4 py-3">
                <dt className="text-meta text-foreground-muted">Current</dt>
                <dd className="text-title font-medium tabular-nums text-foreground">
                  {formatQuantity(item.currentQuantity, item.unitSymbol)}
                </dd>
              </div>
              <div className="flex flex-col justify-center gap-0.5 bg-card px-4 py-3">
                <dt className="text-meta text-foreground-muted">Available</dt>
                <dd className="text-title font-medium tabular-nums text-foreground">
                  {formatQuantity(item.availableQuantity, item.unitSymbol)}
                </dd>
              </div>
              <div className="flex flex-col justify-center gap-0.5 bg-card px-4 py-3">
                <dt className="text-meta text-foreground-muted">Reserved</dt>
                <dd className="text-title font-medium tabular-nums text-foreground">
                  {formatQuantity(item.reservedQuantity, item.unitSymbol)}
                </dd>
              </div>
              <div className="flex flex-col justify-center gap-0.5 bg-card px-4 py-3">
                <dt className="inline-flex items-center gap-1.5 text-meta text-foreground-muted">
                  Reorder level
                  <ReorderLevelHelpIcon />
                </dt>
                <dd className="text-title font-medium tabular-nums text-foreground">
                  {formatQuantity(item.reorderLevel, item.unitSymbol)}
                </dd>
              </div>
              <div className="flex flex-col justify-center gap-0.5 bg-card px-4 py-3">
                <dt className="text-meta text-foreground-muted">Avg cost</dt>
                <dd className="text-title font-medium tabular-nums text-foreground">
                  {formatMoney(item.averageCost)}
                </dd>
              </div>
              <div className="flex flex-col justify-center gap-0.5 bg-card px-4 py-3">
                <dt className="text-meta text-foreground-muted">Value</dt>
                <dd className="text-title font-medium tabular-nums text-foreground">
                  {formatMoney(item.inventoryValue)}
                </dd>
              </div>
            </dl>

            {/* The accounting caveat belongs with the figure it qualifies:
                this value is not yet backed by a posted bill. */}
            {item.accountingStatus === "pending_bill_posting" ? (
              <div className="space-y-1">
                <Badge variant="warning">
                  {item.accountingStatusLabel || "Pending Bill Posting"}
                </Badge>
                <p className="text-meta text-foreground-muted">{item.accountingStatusDetail}</p>
              </div>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-title text-foreground">Recent movements</h3>
              {movementsLoading ? (
                <p className="text-sm text-foreground-muted">Loading movements...</p>
              ) : movements.length > 0 ? (
                <StockMovementsTable movements={movements.slice(0, 5)} />
              ) : (
                <p className="text-sm text-foreground-muted">No movements recorded.</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-title text-foreground">Expiry batches</h3>
              {item.isExpiryTracked ? (
                <ExpiryBatchesSection
                  batches={batches}
                  canManage={canManageBatches}
                  isLoading={batchesLoading}
                  onStatusChange={onBatchStatusChange}
                />
              ) : (
                <p className="text-sm text-foreground-muted">Expiry tracking is disabled.</p>
              )}
            </section>

            {/* Actions last, per the prototype. The trade is real: "Adjust
                stock" is the primary action and now sits below two tables. In
                exchange "View all movements" lands directly under the movements
                section it continues. If the scroll proves annoying the fix is a
                sticky footer, not moving this back up. */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {canManage ? (
                <Button onClick={() => onAdjust(item)} type="button">
                  <SlidersHorizontal className="h-4 w-4" />
                  Adjust stock
                </Button>
              ) : null}
              {canManageBatches && item.isExpiryTracked ? (
                <Button onClick={() => onAddBatch(item)} type="button" variant="outline">
                  <PackagePlus className="h-4 w-4" />
                  Add expiry batch
                </Button>
              ) : null}
              <Button asChild type="button" variant="outline">
                <Link href={`/inventory/movements?item=${item.id}`}>
                  <History className="h-4 w-4" />
                  View all movements
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
