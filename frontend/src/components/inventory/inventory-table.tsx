import { Plus } from "lucide-react";
import type { JSX } from "react";

import { InventoryActionsMenu } from "@/components/inventory/inventory-actions-menu";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
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

/**
 * Eight columns, down from fourteen.
 *
 * A list is scanned, not read. The six columns that left -- Type, Current Qty,
 * Reserved, Avg Cost, Reorder, Expiry -- are what you check about one item once
 * it has caught your eye, and every one of them is in the details drawer behind
 * the row's View action. What stays is what you scan a stock list for: what it
 * is, where it is, how much you can sell, what it is worth, and whether it
 * needs attention.
 *
 * Available is the quantity kept rather than Current, because it is the number
 * that answers "can I sell this" -- Current minus what is already committed.
 * Both are in the drawer where the difference between them is the point.
 */
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
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Available</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Stock Level</TableHead>
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
                  <p className="font-medium">{item.itemName}</p>
                  <p className="text-xs text-brand-mocha">
                    {item.itemCode || (isNotInitialized ? "Catalog item without stock" : "No code")}
                  </p>
                  {item.variantName ? (
                    <p className="text-xs text-brand-mocha">Variant: {item.variantName}</p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{item.branchName}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatQuantity(item.availableQuantity)}
              </TableCell>
              <TableCell>{item.unitSymbol || item.unitName}</TableCell>
              <TableCell className="text-right">
                <div className="space-y-1">
                  <p className="font-medium tabular-nums">{formatMoney(item.inventoryValue)}</p>
                  {item.accountingStatus === "pending_bill_posting" ? (
                    <Badge className="border-warning/30 bg-warning-tint text-warning-text">
                      {item.accountingStatusLabel || "Pending Bill Posting"}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <StockLevelBadge item={item} />
              </TableCell>
              <TableCell>
                <InventoryStatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
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
                  {!isNotInitialized ? (
                    <InventoryActionsMenu
                      canManage={canManage}
                      item={item}
                      onAddBatch={onAddBatch}
                      onAdjust={onAdjust}
                      onView={onView}
                      showBatchAction={showBatchAction}
                      showViewAction={showViewAction}
                    />
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
