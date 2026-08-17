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

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-card/80 p-4 lg:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))]">
      <Input
        aria-label="Search purchasing records"
        onChange={(event) => updateFilter({ search: event.target.value })}
        placeholder="Search number, supplier..."
        value={filters.search}
      />
      <Select
        value={filters.supplierId}
        onValueChange={(supplierId) => updateFilter({ supplierId })}
      >
        <SelectTrigger>
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
        <SelectTrigger>
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
        <SelectTrigger>
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
          <SelectTrigger>
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
        onChange={(event) => updateFilter({ dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <div className="flex gap-3">
        <Input
          aria-label="Date to"
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
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
