"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MasterDataFilters = {
  search: string;
  status: "all" | "active" | "inactive";
};

export const defaultMasterDataFilters: MasterDataFilters = {
  search: "",
  status: "all",
};

/**
 * None of the six master data screens had a search box. A seeded units list
 * runs to dozens of rows, and finding one meant reading the table.
 */
export function MasterDataToolbar({
  filters,
  noun,
  onFiltersChange,
}: {
  filters: MasterDataFilters;
  /** "units", "product categories", … — used in the search placeholder. */
  noun: string;
  onFiltersChange: (filters: MasterDataFilters) => void;
}): JSX.Element {
  const hiddenFilterCount = filters.status === "all" ? 0 : 1;

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultMasterDataFilters)}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle={`Filter ${noun}`}
      searchAriaLabel={`Search ${noun}`}
      searchPlaceholder={`Search ${noun}...`}
      searchValue={filters.search}
    >
      <FilterField htmlFor="masterDataFilterStatus" label="Status">
        <Select
          onValueChange={(status) =>
            onFiltersChange({ ...filters, status: status as MasterDataFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger id="masterDataFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </FilterToolbar>
  );
}
