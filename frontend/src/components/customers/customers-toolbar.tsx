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
import type { CustomerFilters, CustomerTag } from "@/types/customer";

const defaultFilters: CustomerFilters = {
  search: "",
  status: "all",
  tagId: "all",
  dateFrom: "",
  dateTo: "",
};

type CustomersToolbarProps = {
  filters: CustomerFilters;
  onFiltersChange: (filters: CustomerFilters) => void;
  tags: CustomerTag[];
};

/**
 * Search stays in the toolbar; status, tag and the created-date range live in
 * the Filters popover, the same idiom as the orders and inventory lists.
 */
export function CustomersToolbar({
  filters,
  onFiltersChange,
  tags,
}: CustomersToolbarProps): JSX.Element {
  const update = (patch: Partial<CustomerFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  // Only what sits inside the popover counts toward the badge. Search is
  // visible in the toolbar and shows its own state.
  const hiddenFilterCount =
    (filters.status !== defaultFilters.status ? 1 : 0) +
    (filters.tagId !== defaultFilters.tagId ? 1 : 0) +
    (filters.dateFrom.length > 0 ? 1 : 0) +
    (filters.dateTo.length > 0 ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultFilters)}
      onSearchChange={(search) => update({ search })}
      popoverTitle="Filter customers"
      searchAriaLabel="Search customers"
      searchPlaceholder="Search name, phone, email..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="customersFilterStatus" label="Status">
        <Select
          onValueChange={(status) => update({ status: status as CustomerFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id="customersFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="customersFilterTag" label="Tag">
        <Select onValueChange={(tagId) => update({ tagId })} value={filters.tagId}>
          <SelectTrigger id="customersFilterTag">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.tagName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-3">
        <FilterField htmlFor="customersFilterDateFrom" label="Created from">
          <Input
            id="customersFilterDateFrom"
            onChange={(event) => update({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="customersFilterDateTo" label="Created to">
          <Input
            id="customersFilterDateTo"
            onChange={(event) => update({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
