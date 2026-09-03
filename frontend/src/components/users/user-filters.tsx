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
import type { Branch } from "@/types/branch";
import type { UserFilters as UserFiltersValue } from "@/types/user";

type UserFiltersProps = {
  allowAllBranches?: boolean;
  branchOptions: Branch[];
  filters: UserFiltersValue;
  onFiltersChange: (nextFilters: UserFiltersValue) => void;
  onReset: () => void;
  showBranchFilter: boolean;
  showUnassignedBranch?: boolean;
};

export const allBranchesFilterValue = "__all_branches__";
export const unassignedBranchFilterValue = "__unassigned_branch__";

function isFilterStatus(value: string): value is UserFiltersValue["status"] {
  return (
    value === "all" ||
    value === "active" ||
    value === "inactive" ||
    value === "suspended" ||
    value === "invited"
  );
}

/**
 * Search stays visible; status and branch move into the popover.
 *
 * Branch is a real filter here rather than scope -- an admin looking at staff
 * can legitimately ask "who has no branch yet" -- so unlike the operational
 * lists it counts toward the badge.
 */
function countHiddenFilters(filters: UserFiltersValue, showBranchFilter: boolean): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (showBranchFilter && (filters.branchId ?? allBranchesFilterValue) !== allBranchesFilterValue) {
    count += 1;
  }
  return count;
}

export function UserFilters({
  allowAllBranches = true,
  branchOptions,
  filters,
  onFiltersChange,
  onReset,
  showBranchFilter,
  showUnassignedBranch = true,
}: UserFiltersProps): JSX.Element {
  const selectedBranchValue = filters.branchId ?? allBranchesFilterValue;
  const isKnownSpecialBranchValue =
    selectedBranchValue === allBranchesFilterValue ||
    selectedBranchValue === unassignedBranchFilterValue;
  const selectedBranchOption = branchOptions.find((branch) => branch.id === selectedBranchValue);
  const hiddenFilterCount = countHiddenFilters(filters, showBranchFilter);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={onReset}
      onSearchChange={(search) => onFiltersChange({ ...filters, search })}
      popoverTitle="Filter staff users"
      searchAriaLabel="Search staff users"
      searchPlaceholder="Search by name, email, phone, or role"
      searchValue={filters.search}
    >
      <FilterField htmlFor="userFilterStatus" label="Status">
        <Select
          onValueChange={(value) => {
            if (!isFilterStatus(value)) {
              return;
            }
            onFiltersChange({ ...filters, status: value });
          }}
          value={filters.status}
        >
          <SelectTrigger id="userFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {showBranchFilter ? (
        <FilterField htmlFor="userFilterBranch" label="Branch">
          <Select
            onValueChange={(branchId) => onFiltersChange({ ...filters, branchId })}
            value={selectedBranchValue}
          >
            <SelectTrigger id="userFilterBranch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {allowAllBranches ? (
                <SelectItem value={allBranchesFilterValue}>All branches</SelectItem>
              ) : null}
              {showUnassignedBranch ? (
                <SelectItem value={unassignedBranchFilterValue}>No branch assigned</SelectItem>
              ) : null}
              {!isKnownSpecialBranchValue && !selectedBranchOption ? (
                <SelectItem value={selectedBranchValue}>Selected branch</SelectItem>
              ) : null}
              {branchOptions.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      ) : null}
    </FilterToolbar>
  );
}
