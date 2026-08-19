"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STOCK_MOVEMENT_TYPE_LABELS } from "@/lib/inventory/stock-movement-display";
import type { Branch } from "@/types/branch";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";
import type { StockMovementFilters } from "@/types/stock-movements";

type MovementsToolbarProps = {
  allowAllBranches?: boolean;
  branches: Branch[];
  filters: StockMovementFilters;
  onFiltersChange: (filters: StockMovementFilters) => void;
  resetBranchId: string;
};

// Derived from the shared label map: this file used to carry the fourth
// hand-written copy of these labels, in a diff whose own comments campaign
// against exactly that drift.
const MOVEMENT_TYPES: readonly { value: string; label: string }[] = Object.entries(
  STOCK_MOVEMENT_TYPE_LABELS,
).map(([value, label]) => ({ label, value }));

function buildResetFilters(resetBranchId: string): StockMovementFilters {
  return {
    search: "",
    branchId: resetBranchId,
    itemType: "all",
    productType: "all",
    movementType: "all",
    direction: "all",
    dateFrom: "",
    dateTo: "",
    createdBy: "",
  };
}

/** Branch is scope and search is visible in the toolbar, so neither counts. */
function countHiddenFilters(filters: StockMovementFilters): number {
  let count = 0;
  if (filters.itemType !== "all") count += 1;
  if (filters.productType !== "all") count += 1;
  if (filters.movementType !== "all") count += 1;
  if (filters.direction !== "all") count += 1;
  if (filters.dateFrom.length > 0) count += 1;
  if (filters.dateTo.length > 0) count += 1;
  return count;
}

export function MovementsToolbar({
  allowAllBranches = true,
  branches,
  filters,
  onFiltersChange,
  resetBranchId,
}: MovementsToolbarProps): JSX.Element {
  const updateFilters = (nextFilters: Partial<StockMovementFilters>): void => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const hiddenFilterCount = countHiddenFilters(filters);
  const isBranchNarrowed = allowAllBranches && filters.branchId !== resetBranchId;
  const hasAnyFilter =
    hiddenFilterCount > 0 || isBranchNarrowed || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      onReset={() => onFiltersChange(buildResetFilters(resetBranchId))}
      onSearchChange={(search) => updateFilters({ search })}
      popoverTitle="Filter movements"
      searchAriaLabel="Search stock movements"
      searchPlaceholder="Search item, reference..."
      searchValue={filters.search}
    >
      {allowAllBranches ? (
        <FilterField htmlFor="movementFilterBranch" label="Branch">
          <Select
            onValueChange={(branchId) => updateFilters({ branchId })}
            value={filters.branchId}
          >
            <SelectTrigger id="movementFilterBranch">
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

      <FilterField htmlFor="movementFilterItemType" label="Item type">
        <Select
          onValueChange={(itemType) =>
            updateFilters({ itemType: itemType as StockMovementFilters["itemType"] })
          }
          value={filters.itemType}
        >
          <SelectTrigger id="movementFilterItemType">
            <SelectValue placeholder="Item type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All item types</SelectItem>
            <SelectItem value="product">Products</SelectItem>
            <SelectItem value="product_variant">Variants</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="movementFilterProductType" label="Product type">
        <Select
          onValueChange={(productType) =>
            updateFilters({ productType: productType as StockMovementFilters["productType"] })
          }
          value={filters.productType}
        >
          <SelectTrigger id="movementFilterProductType">
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

      <FilterField htmlFor="movementFilterMovementType" label="Movement">
        <Select
          onValueChange={(movementType) =>
            updateFilters({ movementType: movementType as StockMovementFilters["movementType"] })
          }
          value={filters.movementType}
        >
          <SelectTrigger id="movementFilterMovementType">
            <SelectValue placeholder="Movement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All movements</SelectItem>
            {MOVEMENT_TYPES.map((movementType) => (
              <SelectItem key={movementType.value} value={movementType.value}>
                {movementType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="movementFilterDirection" label="Direction">
        <Select
          onValueChange={(direction) =>
            updateFilters({ direction: direction as StockMovementFilters["direction"] })
          }
          value={filters.direction}
        >
          <SelectTrigger id="movementFilterDirection">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="in">In</SelectItem>
            <SelectItem value="out">Out</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <FilterField htmlFor="movementFilterDateFrom" label="From">
          <Input
            id="movementFilterDateFrom"
            onChange={(event) => updateFilters({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="movementFilterDateTo" label="To">
          <Input
            id="movementFilterDateTo"
            onChange={(event) => updateFilters({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
