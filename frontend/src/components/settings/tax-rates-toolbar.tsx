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

export type TaxRateFilters = {
  search: string;
  status: "all" | "active" | "inactive";
  taxType: string;
};

export const defaultTaxRateFilters: TaxRateFilters = {
  search: "",
  status: "all",
  taxType: "all",
};

/** Search is visible in the toolbar, so it does not count toward the badge. */
function countHiddenFilters(filters: TaxRateFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.taxType !== "all") count += 1;
  return count;
}

export function TaxRatesToolbar({
  filters,
  onFiltersChange,
  taxTypes,
}: {
  filters: TaxRateFilters;
  onFiltersChange: (filters: TaxRateFilters) => void;
  /** The types actually present, so the filter never offers an empty result. */
  taxTypes: string[];
}): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultTaxRateFilters)}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle="Filter tax rates"
      searchAriaLabel="Search tax rates"
      searchPlaceholder="Search name, type or region..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="taxFilterStatus" label="Status">
        <Select
          onValueChange={(status) =>
            onFiltersChange({ ...filters, status: status as TaxRateFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger id="taxFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {taxTypes.length > 0 ? (
        <FilterField htmlFor="taxFilterType" label="Tax type">
          <Select
            onValueChange={(taxType) => onFiltersChange({ ...filters, taxType })}
            value={filters.taxType}
          >
            <SelectTrigger id="taxFilterType">
              <SelectValue placeholder="Tax type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tax types</SelectItem>
              {taxTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      ) : null}
    </FilterToolbar>
  );
}
