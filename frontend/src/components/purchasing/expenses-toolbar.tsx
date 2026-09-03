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
import type { ExpensesFilters } from "@/types/expenses";

type ExpensesToolbarProps = {
  allowAllBranches: boolean;
  branches: { branchName: string; id: string }[];
  filters: ExpensesFilters;
  onFiltersChange: (patch: Partial<ExpensesFilters>) => void;
  onReset: () => void;
  resetBranchId: string;
};

/**
 * Branch is scope and search is visible in the toolbar, so neither counts
 * toward the badge. Paging and page size are not filters either.
 */
function countHiddenFilters(filters: ExpensesFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.dateFrom.length > 0) count += 1;
  if (filters.dateTo.length > 0) count += 1;
  return count;
}

export function ExpensesToolbar({
  allowAllBranches,
  branches,
  filters,
  onFiltersChange,
  onReset,
  resetBranchId,
}: ExpensesToolbarProps): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);
  const isBranchNarrowed = allowAllBranches && filters.branchId !== resetBranchId;
  const hasAnyFilter =
    hiddenFilterCount > 0 || isBranchNarrowed || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={onReset}
      onSearchChange={(search) => onFiltersChange({ search })}
      popoverTitle="Filter expenses"
      searchAriaLabel="Search expenses"
      searchPlaceholder="Search expense, reference, vendor..."
      searchValue={filters.search}
    >
      {allowAllBranches ? (
        <FilterField htmlFor="expenseFilterBranch" label="Branch">
          <Select
            onValueChange={(branchId) => onFiltersChange({ branchId })}
            value={filters.branchId || "all"}
          >
            <SelectTrigger id="expenseFilterBranch">
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

      <FilterField htmlFor="expenseFilterStatus" label="Status">
        <Select
          onValueChange={(status: ExpensesFilters["status"]) => onFiltersChange({ status })}
          value={filters.status}
        >
          <SelectTrigger id="expenseFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <FilterField htmlFor="expenseFilterDateFrom" label="From">
          <Input
            id="expenseFilterDateFrom"
            onChange={(event) => onFiltersChange({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="expenseFilterDateTo" label="To">
          <Input
            id="expenseFilterDateTo"
            onChange={(event) => onFiltersChange({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
