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

export type SalesChannelFilters = {
  search: string;
  status: "all" | "active" | "inactive";
  type: string;
};

export const defaultSalesChannelFilters: SalesChannelFilters = {
  search: "",
  status: "all",
  type: "all",
};

/** Search is visible in the toolbar, so it does not count toward the badge. */
function countHiddenFilters(filters: SalesChannelFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.type !== "all") count += 1;
  return count;
}

export function SalesChannelsToolbar({
  channelTypes,
  filters,
  onFiltersChange,
}: {
  /** The types actually present, so the filter never offers an empty result. */
  channelTypes: string[];
  filters: SalesChannelFilters;
  onFiltersChange: (filters: SalesChannelFilters) => void;
}): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultSalesChannelFilters)}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle="Filter channels"
      searchAriaLabel="Search sales channels"
      searchPlaceholder="Search channel name or type..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="channelFilterStatus" label="Status">
        <Select
          onValueChange={(status) =>
            onFiltersChange({ ...filters, status: status as SalesChannelFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger id="channelFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {channelTypes.length > 0 ? (
        <FilterField htmlFor="channelFilterType" label="Channel type">
          <Select
            onValueChange={(type) => onFiltersChange({ ...filters, type })}
            value={filters.type}
          >
            <SelectTrigger id="channelFilterType">
              <SelectValue placeholder="Channel type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {channelTypes.map((type) => (
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
