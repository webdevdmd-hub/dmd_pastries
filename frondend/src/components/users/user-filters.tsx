"use client";

import { Search } from "lucide-react";
import type { JSX } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";
import type { UserFilters } from "@/types/user";

type UserFiltersProps = {
  allowAllBranches?: boolean;
  branchOptions: Branch[];
  filters: UserFilters;
  onFiltersChange: (nextFilters: UserFilters) => void;
  showUnassignedBranch?: boolean;
  showBranchFilter: boolean;
};

export const allBranchesFilterValue = "__all_branches__";
export const unassignedBranchFilterValue = "__unassigned_branch__";

function isFilterStatus(value: string): value is UserFilters["status"] {
  return (
    value === "all" ||
    value === "active" ||
    value === "inactive" ||
    value === "suspended" ||
    value === "invited"
  );
}

export function UserFilters({
  allowAllBranches = true,
  branchOptions,
  filters,
  onFiltersChange,
  showUnassignedBranch = true,
  showBranchFilter,
}: UserFiltersProps): JSX.Element {
  const selectedBranchValue = filters.branchId ?? allBranchesFilterValue;
  const isKnownSpecialBranchValue =
    selectedBranchValue === allBranchesFilterValue ||
    selectedBranchValue === unassignedBranchFilterValue;
  const selectedBranchOption = branchOptions.find((branch) => branch.id === selectedBranchValue);

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
        <Input
          aria-label="Search staff users"
          className="pl-9"
          placeholder="Search by name, email, phone, or role"
          value={filters.search}
          onChange={(event) => {
            onFiltersChange({
              ...filters,
              search: event.target.value,
            });
          }}
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) => {
          if (!isFilterStatus(value)) {
            return;
          }

          onFiltersChange({
            ...filters,
            status: value,
          });
        }}
      >
        <SelectTrigger aria-label="Filter users by status" className="md:max-w-56">
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

      {showBranchFilter ? (
        <Select
          value={selectedBranchValue}
          onValueChange={(value) => {
            onFiltersChange({
              ...filters,
              branchId: value,
            });
          }}
        >
          <SelectTrigger aria-label="Filter users by branch" className="md:max-w-64">
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
      ) : null}
    </div>
  );
}
