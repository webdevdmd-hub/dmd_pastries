"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
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
 * Search and lowStockOnly are excluded: search shows its own value in the
 * toolbar, and lowStockOnly is the "Low stock" tab, visible one row up.
 * Branch is scope, not a filter -- it always carries a value.
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
  // lowStockOnly is excluded from the badge but included here, because Reset
  // does clear it.
  const hasAnyFilter =
    hiddenFilterCount > 0 ||
    isBranchNarrowed ||
    filters.lowStockOnly ||
    filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      onReset={() => onFiltersChange(buildResetFilters(resetBranchId))}
      onSearchChange={(search) => updateFilters({ search })}
      popoverTitle="Filter inventory"
      searchAriaLabel="Search inventory"
      searchPlaceholder="Search item, code..."
      searchValue={filters.search}
    >
      {allowAllBranches ? (
        <FilterField htmlFor="inventoryFilterBranch" label="Branch">
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
        </FilterField>
      ) : null}

      <FilterField htmlFor="inventoryFilterItemType" label="Item type">
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
      </FilterField>

      <FilterField htmlFor="inventoryFilterProductType" label="Product type">
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
      </FilterField>

      <FilterField htmlFor="inventoryFilterStatus" label="Status">
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
      </FilterField>

      <div className="flex flex-col gap-2.5 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={filters.expiryTrackedOnly}
            onCheckedChange={(checked) => updateFilters({ expiryTrackedOnly: checked === true })}
          />
          Expiry tracked
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={filters.includeUninitialized}
            onCheckedChange={(checked) => updateFilters({ includeUninitialized: checked === true })}
          />
          Include catalog items without stock
        </label>
      </div>
    </FilterToolbar>
  );
}
