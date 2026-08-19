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
          <SheetDescription>
            Branch stock, recent movements, and expiry batch visibility.
          </SheetDescription>
        </SheetHeader>

        {item ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Current</p>
                <p className="mt-2 text-2xl font-medium tabular-nums text-foreground">
                  {formatQuantity(item.currentQuantity, item.unitSymbol)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Available</p>
                <p className="mt-2 text-2xl font-medium tabular-nums text-foreground">
                  {formatQuantity(item.availableQuantity, item.unitSymbol)}
                </p>
              </div>
              {/* Reserved and Reorder level are here because the list no longer
                  carries them. Reserved only means anything next to Current and
                  Available -- it is the difference between them -- so the three
                  belong together, which a 14-column list could never show. */}
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Reserved</p>
                <p className="mt-2 text-2xl font-medium tabular-nums text-foreground">
                  {formatQuantity(item.reservedQuantity, item.unitSymbol)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="flex items-center gap-1">
                  <p className="text-xs text-foreground-muted">Reorder level</p>
                  <ReorderLevelHelpIcon />
                </div>
                <p className="mt-2 text-2xl font-medium tabular-nums text-foreground">
                  {formatQuantity(item.reorderLevel, item.unitSymbol)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Branch</p>
                <p className="mt-2 font-medium text-foreground">{item.branchName}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <InventoryStatusBadge status={item.status} />
                  <StockLevelBadge item={item} />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Item Identity</p>
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <p className="font-medium">
                    {item.productType ? PRODUCT_TYPE_LABELS[item.productType] : "Legacy item"}
                  </p>
                  {/* The list's "Type" column landed here. It is the structural
                      kind (Product Master / Variant / legacy), which is a
                      different axis from productType above. */}
                  <p className="text-foreground-muted">{typeLabel(item.itemType)}</p>
                  {item.variantName ? <p>Variant: {item.variantName}</p> : null}
                  <p className="text-foreground-muted">{item.itemCode || "No code"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-xs text-foreground-muted">Inventory Value</p>
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <p>
                    Avg cost:{" "}
                    <span className="font-medium tabular-nums">
                      {formatMoney(item.averageCost)}
                    </span>
                  </p>
                  <p>
                    Value:{" "}
                    <span className="font-medium tabular-nums">
                      {formatMoney(item.inventoryValue)}
                    </span>
                  </p>
                  {item.accountingStatus === "pending_bill_posting" ? (
                    <div className="space-y-1 pt-1">
                      <Badge variant="warning">
                        {item.accountingStatusLabel || "Pending Bill Posting"}
                      </Badge>
                      <p className="text-xs text-foreground-muted">{item.accountingStatusDetail}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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

            <section className="space-y-3">
              <h3 className="text-lg font-medium text-foreground">Recent movements</h3>
              {movementsLoading ? (
                <p className="text-sm text-foreground-muted">Loading movements...</p>
              ) : movements.length > 0 ? (
                <StockMovementsTable movements={movements.slice(0, 5)} />
              ) : (
                <p className="text-sm text-foreground-muted">No movements recorded.</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-medium text-foreground">Expiry batches</h3>
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
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
