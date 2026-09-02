"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SupplierFilters } from "@/types/supplier";

const defaultFilters: SupplierFilters = {
  search: "",
  status: "all",
  country: "",
  missingTermsOnly: false,
};

type SuppliersToolbarProps = {
  filters: SupplierFilters;
  onFiltersChange: (filters: SupplierFilters) => void;
};

/**
 * Search stays in the toolbar; status, country and the missing-terms switch
 * live in the Filters popover, the same idiom as the customers and orders
 * lists. The attention strip above can set the missing-terms filter with one
 * click; the popover is where it is turned off again, so it must show there.
 */
export function SuppliersToolbar({ filters, onFiltersChange }: SuppliersToolbarProps): JSX.Element {
  const update = (patch: Partial<SupplierFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  // Only what sits inside the popover counts toward the badge. Search is
  // visible in the toolbar and shows its own state.
  const hiddenFilterCount =
    (filters.status !== defaultFilters.status ? 1 : 0) +
    (filters.country.trim().length > 0 ? 1 : 0) +
    (filters.missingTermsOnly ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultFilters)}
      onSearchChange={(search) => update({ search })}
      popoverTitle="Filter suppliers"
      searchAriaLabel="Search suppliers"
      searchPlaceholder="Search name, code, contact, phone..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="suppliersFilterStatus" label="Status">
        <Select
          onValueChange={(status) => update({ status: status as SupplierFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id="suppliersFilterStatus">
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

      <FilterField htmlFor="suppliersFilterCountry" label="Country">
        <Input
          id="suppliersFilterCountry"
          onChange={(event) => update({ country: event.target.value })}
          placeholder="Any"
          value={filters.country}
        />
      </FilterField>

      <label className="flex items-center gap-3 text-cell">
        <Checkbox
          checked={filters.missingTermsOnly}
          onCheckedChange={(checked) => update({ missingTermsOnly: checked === true })}
        />
        <span className="grid gap-0.5">
          <span className="font-medium">Missing payment terms only</span>
          <span className="text-meta text-foreground-muted">
            Suppliers a purchase order cannot be costed against yet.
          </span>
        </span>
      </label>
    </FilterToolbar>
  );
}
