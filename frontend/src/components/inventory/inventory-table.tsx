import { Eye, History, PackagePlus, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryItem } from "@/types/inventory";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

type InventoryTableProps = {
  canManage: boolean;
  items: InventoryItem[];
  onAddBatch: (item: InventoryItem) => void;
  onAddOpeningStock: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  onView: (item: InventoryItem) => void;
  showBatchAction?: boolean;
  showViewAction?: boolean;
};

function typeLabel(value: InventoryItem["itemType"]): string {
  if (value === "product") return "Product Master";
  if (value === "product_variant") return "Product Variant";
  if (value === "ingredient") return "Legacy Ingredient";
  return "Legacy Packaging";
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function InventoryTable({
  canManage,
  items,
  onAddBatch,
  onAddOpeningStock,
  onAdjust,
  onView,
  showBatchAction = true,
  showViewAction = true,
}: InventoryTableProps): JSX.Element {
  const catalogRowClassName = "bg-info-tint/70";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Current Qty</TableHead>
          <TableHead>Reserved</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Avg Cost</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>
            <ReorderLevelHeader>Reorder</ReorderLevelHeader>
          </TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Stock Level</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isNotInitialized = item.status === "not_initialized" || item.id.length === 0;
          const canCreateProductMasterOpeningStock =
            isNotInitialized &&
            item.canAddOpeningStock &&
            (item.itemType === "product" || item.itemType === "product_variant");
          const rowKey =
            item.id ||
            `${item.itemType}-${
              item.productVariantId ??
              item.productId ??
              item.ingredientId ??
              item.packagingItemId ??
              item.itemName
            }`;

          return (
            <TableRow
              className={
                isNotInitialized
                  ? catalogRowClassName
                  : item.lowStock
                    ? "bg-warning-tint/70"
                    : undefined
              }
              key={rowKey}
            >
              <TableCell>
                <div>
                  <p className="font-bold">{item.itemName}</p>
                  <p className="text-xs text-brand-mocha">
                    {item.itemCode ||
                      (isNotInitialized ? "Catalog item without stock" : item.id.slice(0, 8))}
                  </p>
                  {item.variantName ? (
                    <p className="text-xs text-brand-mocha">Variant: {item.variantName}</p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p>{typeLabel(item.itemType)}</p>
                  {item.productType ? (
                    <p className="text-xs text-brand-mocha">
                      {PRODUCT_TYPE_LABELS[item.productType]}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{item.branchName}</TableCell>
              <TableCell>{formatQuantity(item.currentQuantity)}</TableCell>
              <TableCell>{formatQuantity(item.reservedQuantity)}</TableCell>
              <TableCell className="font-bold">{formatQuantity(item.availableQuantity)}</TableCell>
              <TableCell>{formatMoney(item.averageCost)}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-semibold">{formatMoney(item.inventoryValue)}</p>
                  {item.accountingStatus === "pending_bill_posting" ? (
                    <Badge className="border-warning/30 bg-warning-tint text-warning-text">
                      {item.accountingStatusLabel || "Pending Bill Posting"}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{formatQuantity(item.reorderLevel)}</TableCell>
              <TableCell>{item.unitSymbol || item.unitName}</TableCell>
              <TableCell>
                <StockLevelBadge item={item} />
              </TableCell>
              <TableCell>{item.isExpiryTracked ? "Tracked" : "Not tracked"}</TableCell>
              <TableCell>
                <InventoryStatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {showViewAction && !isNotInitialized ? (
                    <Button
                      aria-label={`View ${item.itemName}`}
                      onClick={() => onView(item)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {!isNotInitialized ? (
                    <Button
                      asChild
                      aria-label={`Movements for ${item.itemName}`}
                      size="icon"
                      variant="ghost"
                    >
                      <Link href={`/inventory/movements?item=${item.id}`}>
                        <History className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {canManage && canCreateProductMasterOpeningStock ? (
                    <Button
                      aria-label={`Add opening stock for ${item.itemName}`}
                      onClick={() => onAddOpeningStock(item)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4" />
                      Add Opening Stock
                    </Button>
                  ) : null}
                  {canManage &&
                  isNotInitialized &&
                  item.canAddOpeningStock &&
                  !canCreateProductMasterOpeningStock ? (
                    <span className="rounded-full border border-brand-cappuccino px-2 py-1 text-xs text-brand-mocha">
                      Legacy read-only
                    </span>
                  ) : null}
                  {canManage && !isNotInitialized ? (
                    <>
                      <Button
                        aria-label={`Adjust ${item.itemName}`}
                        onClick={() => onAdjust(item)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      {showBatchAction && item.isExpiryTracked ? (
                        <Button
                          aria-label={`Add expiry batch for ${item.itemName}`}
                          onClick={() => onAddBatch(item)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
