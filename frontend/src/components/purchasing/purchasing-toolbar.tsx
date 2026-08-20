"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
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
};

export function PurchasingToolbar({
  allowAllBranches = true,
  branches,
  filters,
  onFiltersChange,
  paymentStatuses,
  resetBranchId,
  statuses,
  suppliers,
}: PurchasingToolbarProps): JSX.Element {
  const updateFilter = (patch: Partial<PurchasingFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  // Six or seven controls used to snap onto one grid row the moment the
  // VIEWPORT hit lg. The viewport is not the width this toolbar gets: with the
  // sidebar open, a 1030px window leaves main 742px, so each control was
  // allotted 91px and the date-to input rendered 25px wide -- a date field you
  // cannot read or type into. Wrapping on the toolbar's own width needs no
  // breakpoint to be guessed right: each control asks for a readable basis,
  // takes a share of what is left, and drops to the next row when there is no
  // room.
  //
  // The sizing sits on each control rather than on the parent as [&>*]:flex-1.
  // That arbitrary variant compiles to a two-class selector, which outranks a
  // plain .flex-none on a child, so Reset could not opt out of stretching and
  // rendered 629px wide.
  const control = "min-w-0 flex-1 basis-36";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-brand-cappuccino/60 bg-card p-4">
      <Input
        aria-label="Search purchasing records"
        className={cn(control, "basis-48")}
        onChange={(event) => updateFilter({ search: event.target.value })}
        placeholder="Search number, supplier..."
        value={filters.search}
      />
      <Select
        value={filters.supplierId}
        onValueChange={(supplierId) => updateFilter({ supplierId })}
      >
        <SelectTrigger className={control}>
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
      <Select value={filters.branchId} onValueChange={(branchId) => updateFilter({ branchId })}>
        <SelectTrigger className={control}>
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
      <Select value={filters.status} onValueChange={(status) => updateFilter({ status })}>
        <SelectTrigger className={control}>
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
      {paymentStatuses ? (
        <Select
          value={filters.paymentStatus ?? "all"}
          onValueChange={(paymentStatus) => updateFilter({ paymentStatus })}
        >
          <SelectTrigger className={control}>
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
      ) : null}
      <Input
        aria-label="Date from"
        className={cn(control, "min-w-36")}
        onChange={(event) => updateFilter({ dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        aria-label="Date to"
        className={cn(control, "min-w-36")}
        onChange={(event) => updateFilter({ dateTo: event.target.value })}
        type="date"
        value={filters.dateTo}
      />
      <Button
        onClick={() => {
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
        className="flex-none"
        type="button"
        variant="outline"
      >
        Reset
      </Button>
    </div>
  );
}
