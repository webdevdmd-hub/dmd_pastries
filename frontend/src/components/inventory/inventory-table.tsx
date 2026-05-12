import { Eye, History, PackagePlus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
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
  onAdjust: (item: InventoryItem) => void;
  onView: (item: InventoryItem) => void;
  showBatchAction?: boolean;
  showViewAction?: boolean;
};

function typeLabel(value: InventoryItem["itemType"]): string {
  if (value === "product") return "Product";
  if (value === "ingredient") return "Ingredient";
  return "Packaging";
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
}

export function InventoryTable({
  canManage,
  items,
  onAddBatch,
  onAdjust,
  onView,
  showBatchAction = true,
  showViewAction = true,
}: InventoryTableProps): JSX.Element {
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
          <TableHead>Reorder</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Stock Level</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow className={item.lowStock ? "bg-amber-50/70" : undefined} key={item.id}>
            <TableCell>
              <div>
                <p className="font-bold">{item.itemName}</p>
                <p className="text-xs text-brand-mocha">{item.itemCode || item.id.slice(0, 8)}</p>
              </div>
            </TableCell>
            <TableCell>{typeLabel(item.itemType)}</TableCell>
            <TableCell>{item.branchName}</TableCell>
            <TableCell>{formatQuantity(item.currentQuantity)}</TableCell>
            <TableCell>{formatQuantity(item.reservedQuantity)}</TableCell>
            <TableCell className="font-bold">{formatQuantity(item.availableQuantity)}</TableCell>
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
                {showViewAction ? (
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
                {canManage ? (
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
        ))}
      </TableBody>
    </Table>
  );
}
