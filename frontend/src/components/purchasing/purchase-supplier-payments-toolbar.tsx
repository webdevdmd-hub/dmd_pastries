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
  PurchasingSupplierOption,
  SupplierPaymentFilters,
} from "@/types/purchasing";
import type { PaymentMethod } from "@/types/settings";

type SupplierPaymentsToolbarProps = {
  branches: PurchasingBranchOption[];
  canAccessAllBranches: boolean;
  filters: SupplierPaymentFilters;
  onFiltersChange: (patch: Partial<SupplierPaymentFilters>) => void;
  onReset: () => void;
  paymentMethods: PaymentMethod[];
  suppliers: PurchasingSupplierOption[];
};

const paymentStatuses = [
  { label: "Completed", value: "completed" },
  { label: "Voided", value: "voided" },
];

/**
 * Search stays in the toolbar; supplier, branch, method, status and the date
 * range live in the Filters popover. Branch is scope, not a filter: it always
 * carries a value, so it never counts toward the badge and Reset leaves it.
 */
export function PurchaseSupplierPaymentsToolbar({
  branches,
  canAccessAllBranches,
  filters,
  onFiltersChange,
  onReset,
  paymentMethods,
  suppliers,
}: SupplierPaymentsToolbarProps): JSX.Element {
  const hiddenFilterCount =
    (filters.supplierId !== "all" ? 1 : 0) +
    (filters.paymentMethodId !== "all" ? 1 : 0) +
    (filters.paymentStatus !== "all" ? 1 : 0) +
    (filters.dateFrom.length > 0 ? 1 : 0) +
    (filters.dateTo.length > 0 ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={onReset}
      onSearchChange={(search) => onFiltersChange({ search })}
      popoverTitle="Filter payments made"
      searchAriaLabel="Search supplier payments"
      searchPlaceholder="Search supplier, reference, method..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="supplierPaymentsFilterSupplier" label="Supplier">
        <Select
          onValueChange={(supplierId) => onFiltersChange({ supplierId })}
          value={filters.supplierId}
        >
          <SelectTrigger id="supplierPaymentsFilterSupplier">
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

      <FilterField htmlFor="supplierPaymentsFilterBranch" label="Branch">
        <Select
          onValueChange={(branchId) => onFiltersChange({ branchId })}
          value={filters.branchId}
        >
          <SelectTrigger id="supplierPaymentsFilterBranch">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {canAccessAllBranches ? <SelectItem value="all">All branches</SelectItem> : null}
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-3">
        <FilterField htmlFor="supplierPaymentsFilterMethod" label="Method">
          <Select
            onValueChange={(paymentMethodId) => onFiltersChange({ paymentMethodId })}
            value={filters.paymentMethodId}
          >
            <SelectTrigger id="supplierPaymentsFilterMethod">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {paymentMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.methodName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField htmlFor="supplierPaymentsFilterStatus" label="Status">
          <Select
            onValueChange={(paymentStatus) => onFiltersChange({ paymentStatus })}
            value={filters.paymentStatus}
          >
            <SelectTrigger id="supplierPaymentsFilterStatus">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {paymentStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FilterField htmlFor="supplierPaymentsFilterDateFrom" label="From">
          <Input
            id="supplierPaymentsFilterDateFrom"
            onChange={(event) => onFiltersChange({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="supplierPaymentsFilterDateTo" label="To">
          <Input
            id="supplierPaymentsFilterDateTo"
            onChange={(event) => onFiltersChange({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
