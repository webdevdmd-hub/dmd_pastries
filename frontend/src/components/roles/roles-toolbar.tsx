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

export type RolesFilters = {
  search: string;
  status: "all" | "active" | "inactive";
  type: "all" | "system" | "custom";
};

export const defaultRolesFilters: RolesFilters = {
  search: "",
  status: "all",
  type: "all",
};

/** Search is visible in the toolbar, so it does not count toward the badge. */
function countHiddenFilters(filters: RolesFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.type !== "all") count += 1;
  return count;
}

export function RolesToolbar({
  filters,
  onFiltersChange,
}: {
  filters: RolesFilters;
  onFiltersChange: (filters: RolesFilters) => void;
}): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultRolesFilters)}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle="Filter roles"
      searchAriaLabel="Search roles"
      searchPlaceholder="Search role name or description..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="roleFilterStatus" label="Status">
        <Select
          onValueChange={(status) =>
            onFiltersChange({ ...filters, status: status as RolesFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger id="roleFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="roleFilterType" label="Type">
        <Select
          onValueChange={(type) =>
            onFiltersChange({ ...filters, type: type as RolesFilters["type"] })
          }
          value={filters.type}
        >
          <SelectTrigger id="roleFilterType">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="system">System default</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </FilterToolbar>
  );
}
