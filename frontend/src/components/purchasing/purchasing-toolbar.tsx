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
import type {
  PurchasingBranchOption,
  PurchasingFilters,
  PurchasingSupplierOption,
} from "@/types/purchasing";

type PurchasingToolbarProps = {
  allowAllBranches?: boolean;
  filters: PurchasingFilters;
  onFiltersChange: (filters: PurchasingFilters) => void;
  paymentStatuses?: { label: string; value: string }[];
  statuses: { label: string; value: string }[];
  suppliers: PurchasingSupplierOption[];
  branches: PurchasingBranchOption[];
  resetBranchId: string;
  /** Names the list in the popover heading, e.g. "vendor credits". */
  noun?: string;
};

/**
 * The toolbar every purchasing list shares: orders, bills, receipts and
 * vendor credits. Search stays visible; supplier, branch, status, payment
 * status and the date range live in the Filters popover, the same idiom as
 * the other modules. Branch is scope, not a filter: it always carries a
 * value, so it never counts toward the badge and Reset returns it to the
 * user's own branch rather than clearing it.
 */
export function PurchasingToolbar({
  allowAllBranches = true,
  branches,
  filters,
  noun = "records",
  onFiltersChange,
  paymentStatuses,
  resetBranchId,
  statuses,
  suppliers,
}: PurchasingToolbarProps): JSX.Element {
  const updateFilter = (patch: Partial<PurchasingFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  const hiddenFilterCount =
    (filters.supplierId !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (paymentStatuses && (filters.paymentStatus ?? "all") !== "all" ? 1 : 0) +
    (filters.dateFrom.length > 0 ? 1 : 0) +
    (filters.dateTo.length > 0 ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => {
        const resetFilters: PurchasingFilters = {
          branchId: resetBranchId,
          dateFrom: "",
          dateTo: "",
          search: "",
          status: "all",
          supplierId: "all",
        };

        if (paymentStatuses) {
          resetFilters.paymentStatus = "all";
        }

        onFiltersChange(resetFilters);
      }}
      onSearchChange={(search) => updateFilter({ search })}
      popoverTitle={`Filter ${noun}`}
      searchAriaLabel="Search purchasing records"
      searchPlaceholder="Search number, supplier..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="purchasingFilterSupplier" label="Supplier">
        <Select
          onValueChange={(supplierId) => updateFilter({ supplierId })}
          value={filters.supplierId}
        >
          <SelectTrigger id="purchasingFilterSupplier">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.supplierName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="purchasingFilterBranch" label="Branch">
        <Select onValueChange={(branchId) => updateFilter({ branchId })} value={filters.branchId}>
          <SelectTrigger id="purchasingFilterBranch">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {allowAllBranches ? <SelectItem value="all">All branches</SelectItem> : null}
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <div className={paymentStatuses ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
        <FilterField htmlFor="purchasingFilterStatus" label="Status">
          <Select onValueChange={(status) => updateFilter({ status })} value={filters.status}>
            <SelectTrigger id="purchasingFilterStatus">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        {paymentStatuses ? (
          <FilterField htmlFor="purchasingFilterPayment" label="Payment">
            <Select
              onValueChange={(paymentStatus) => updateFilter({ paymentStatus })}
              value={filters.paymentStatus ?? "all"}
            >
              <SelectTrigger id="purchasingFilterPayment">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                {paymentStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FilterField htmlFor="purchasingFilterDateFrom" label="From">
          <Input
            id="purchasingFilterDateFrom"
            onChange={(event) => updateFilter({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="purchasingFilterDateTo" label="To">
          <Input
            id="purchasingFilterDateTo"
            onChange={(event) => updateFilter({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
