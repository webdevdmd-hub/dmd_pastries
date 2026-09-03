"use client";

import type { JSX } from "react";

import { receiptTypeLabels } from "@/components/settings/receipt-layout-shared";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReceiptLayoutType } from "@/types/settings";

export type ReceiptLayoutFilters = {
  receiptType: ReceiptLayoutType | "all";
  scope: "all" | "business" | "branch";
  search: string;
  status: "all" | "active" | "inactive";
};

export const defaultReceiptLayoutFilters: ReceiptLayoutFilters = {
  receiptType: "all",
  scope: "all",
  search: "",
  status: "all",
};

/** Search is visible in the toolbar, so it does not count toward the badge. */
function countHiddenFilters(filters: ReceiptLayoutFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.receiptType !== "all") count += 1;
  if (filters.scope !== "all") count += 1;
  return count;
}

export function ReceiptLayoutsToolbar({
  filters,
  onFiltersChange,
}: {
  filters: ReceiptLayoutFilters;
  onFiltersChange: (filters: ReceiptLayoutFilters) => void;
}): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultReceiptLayoutFilters)}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle="Filter layouts"
      searchAriaLabel="Search receipt layouts"
      searchPlaceholder="Search layout, printer or counter..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="receiptFilterStatus" label="Status">
        <Select
          onValueChange={(status) =>
            onFiltersChange({ ...filters, status: status as ReceiptLayoutFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger id="receiptFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="receiptFilterType" label="Receipt type">
        <Select
          onValueChange={(receiptType) =>
            onFiltersChange({
              ...filters,
              receiptType: receiptType as ReceiptLayoutFilters["receiptType"],
            })
          }
          value={filters.receiptType}
        >
          <SelectTrigger id="receiptFilterType">
            <SelectValue placeholder="Receipt type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All receipt types</SelectItem>
            {Object.entries(receiptTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      {/* Business-wide against branch-specific is the question an operator
          actually asks of this list, and it was not answerable before. */}
      <FilterField htmlFor="receiptFilterScope" label="Applies to">
        <Select
          onValueChange={(scope) =>
            onFiltersChange({ ...filters, scope: scope as ReceiptLayoutFilters["scope"] })
          }
          value={filters.scope}
        >
          <SelectTrigger id="receiptFilterScope">
            <SelectValue placeholder="Applies to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any scope</SelectItem>
            <SelectItem value="business">Business-wide</SelectItem>
            <SelectItem value="branch">A specific branch</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </FilterToolbar>
  );
}
