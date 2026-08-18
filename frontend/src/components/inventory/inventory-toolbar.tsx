"use client";

import { SlidersHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";
import type { InventoryFilters } from "@/types/inventory";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";

type InventoryToolbarProps = {
  allowAllBranches?: boolean;
  branches: Branch[];
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
  resetBranchId: string;
};

function buildResetFilters(resetBranchId: string): InventoryFilters {
  return {
    search: "",
    branchId: resetBranchId,
    itemType: "all",
    productType: "all",
    status: "all",
    lowStockOnly: false,
    expiryTrackedOnly: false,
    includeUninitialized: false,
  };
}

/**
 * Counts only the filters that live inside the popover, so the badge on the
 * trigger describes what is hidden behind it.
 *
 * Three fields are deliberately excluded. Search stays in the toolbar and
 * shows its own value. Branch is scope rather than a filter -- it always
 * carries a value, so counting it would leave the badge permanently at 1 and
 * stop meaning anything. And lowStockOnly is now the "Low stock" tab, which
 * is visible state one row up: counting it here would badge the trigger for
 * something the user can already see they selected, and send them into the
 * popover hunting for a filter that is not in it.
 */
function countHiddenFilters(filters: InventoryFilters): number {
  let count = 0;
  if (filters.itemType !== "all") count += 1;
  if (filters.productType !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.expiryTrackedOnly) count += 1;
  if (filters.includeUninitialized) count += 1;
  return count;
}

export function InventoryToolbar({
  allowAllBranches = true,
  branches,
  filters,
  onFiltersChange,
  resetBranchId,
}: InventoryToolbarProps): JSX.Element {
  const updateFilters = (nextFilters: Partial<InventoryFilters>): void => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const hiddenFilterCount = countHiddenFilters(filters);
  const isBranchNarrowed = allowAllBranches && filters.branchId !== resetBranchId;
  // lowStockOnly is excluded from the badge count (it is the visible tab, not a
  // hidden filter) but included here, because Reset does clear it. A Reset that
  // silently returns the view to All items while refusing to appear for that
  // state would be a button whose visibility disagrees with its effect.
  const hasAnyFilter =
    hiddenFilterCount > 0 ||
    isBranchNarrowed ||
    filters.lowStockOnly ||
    filters.search.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Search inventory"
        className="w-full min-w-[200px] max-w-sm flex-1"
        onChange={(event) => updateFilters({ search: event.target.value })}
        placeholder="Search item, code..."
        value={filters.search}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hiddenFilterCount > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-espresso px-1.5 text-xs font-medium tabular-nums text-brand-latte">
                {hiddenFilterCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-4">
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold">Filter inventory</Label>

            {allowAllBranches ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-brand-mocha" htmlFor="inventoryFilterBranch">
                  Branch
                </Label>
                <Select
                  onValueChange={(branchId) => updateFilters({ branchId })}
                  value={filters.branchId}
                >
                  <SelectTrigger id="inventoryFilterBranch">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-brand-mocha" htmlFor="inventoryFilterItemType">
                Item type
              </Label>
              <Select
                onValueChange={(itemType) =>
                  updateFilters({ itemType: itemType as InventoryFilters["itemType"] })
                }
                value={filters.itemType}
              >
                <SelectTrigger id="inventoryFilterItemType">
                  <SelectValue placeholder="Item type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All item types</SelectItem>
                  <SelectItem value="product">Products</SelectItem>
                  <SelectItem value="product_variant">Variants</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-brand-mocha" htmlFor="inventoryFilterProductType">
                Product type
              </Label>
              <Select
                onValueChange={(productType) =>
                  updateFilters({ productType: productType as InventoryFilters["productType"] })
                }
                value={filters.productType}
              >
                <SelectTrigger id="inventoryFilterProductType">
                  <SelectValue placeholder="Product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All product types</SelectItem>
                  {PRODUCT_TYPES.map((productType) => (
                    <SelectItem key={productType} value={productType}>
                      {PRODUCT_TYPE_LABELS[productType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-brand-mocha" htmlFor="inventoryFilterStatus">
                Status
              </Label>
              <Select
                onValueChange={(status) =>
                  updateFilters({ status: status as InventoryFilters["status"] })
                }
                value={filters.status}
              >
                <SelectTrigger id="inventoryFilterStatus">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-brand-cappuccino pt-3">
              <label className="flex items-center gap-2 text-sm text-brand-espresso">
                <Checkbox
                  checked={filters.expiryTrackedOnly}
                  onCheckedChange={(checked) =>
                    updateFilters({ expiryTrackedOnly: checked === true })
                  }
                />
                Expiry tracked
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-espresso">
                <Checkbox
                  checked={filters.includeUninitialized}
                  onCheckedChange={(checked) =>
                    updateFilters({ includeUninitialized: checked === true })
                  }
                />
                Include catalog items without stock
              </label>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasAnyFilter ? (
        <Button
          onClick={() => onFiltersChange(buildResetFilters(resetBranchId))}
          type="button"
          variant="ghost"
        >
          Reset
        </Button>
      ) : null}
    </div>
  );
}
