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
import type { BatchFilters, ManufacturingProductOption } from "@/types/manufacturing";

type BatchesToolbarProps = {
  allowAllBranches: boolean;
  branches: { branchName: string; id: string }[];
  filters: BatchFilters;
  onFiltersChange: (patch: Partial<BatchFilters>) => void;
  onReset: () => void;
  products: ManufacturingProductOption[];
  resetBranchId: string;
};

/** Branch is scope and search is visible, so neither counts toward the badge. */
function countHiddenFilters(filters: BatchFilters): number {
  let count = 0;
  if (filters.productId !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.dateFrom.length > 0) count += 1;
  if (filters.dateTo.length > 0) count += 1;
  return count;
}

export function BatchesToolbar({
  allowAllBranches,
  branches,
  filters,
  onFiltersChange,
  onReset,
  products,
  resetBranchId,
}: BatchesToolbarProps): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);
  const isBranchNarrowed = allowAllBranches && filters.branchId !== resetBranchId;

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || isBranchNarrowed || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={onReset}
      onSearchChange={(search) => onFiltersChange({ search })}
      popoverTitle="Filter production"
      searchAriaLabel="Search production batches"
      searchPlaceholder="Batch number or product..."
      searchValue={filters.search}
    >
      {allowAllBranches ? (
        <FilterField htmlFor="batchFilterBranch" label="Branch">
          <Select
            onValueChange={(branchId) => onFiltersChange({ branchId })}
            value={filters.branchId}
          >
            <SelectTrigger id="batchFilterBranch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.branchName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      ) : null}

      <FilterField htmlFor="batchFilterProduct" label="Product">
        <Select
          onValueChange={(productId) => onFiltersChange({ productId })}
          value={filters.productId}
        >
          <SelectTrigger id="batchFilterProduct">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.productName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="batchFilterStatus" label="Status">
        <Select
          onValueChange={(status) => onFiltersChange({ status: status as BatchFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id="batchFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft planned</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="partially_completed">Partially completed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <FilterField htmlFor="batchFilterDateFrom" label="From">
          <Input
            id="batchFilterDateFrom"
            onChange={(event) => onFiltersChange({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="batchFilterDateTo" label="To">
          <Input
            id="batchFilterDateTo"
            onChange={(event) => onFiltersChange({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
