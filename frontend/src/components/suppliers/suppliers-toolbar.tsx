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
import type { SupplierCategory, SupplierFilters } from "@/types/supplier";

type SuppliersToolbarProps = {
  categories: SupplierCategory[];
  filters: SupplierFilters;
  onFiltersChange: (filters: SupplierFilters) => void;
};

export function SuppliersToolbar({
  categories,
  filters,
  onFiltersChange,
}: SuppliersToolbarProps): JSX.Element {
  const update = (patch: Partial<SupplierFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-white/75 p-4 shadow-soft lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
      <Input
        aria-label="Search suppliers"
        onChange={(event) => update({ search: event.target.value })}
        placeholder="Search supplier, code, phone, email..."
        value={filters.search}
      />
      <Select
        onValueChange={(supplierCategoryId) => update({ supplierCategoryId })}
        value={filters.supplierCategoryId}
      >
        <SelectTrigger aria-label="Filter by supplier category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.categoryName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(status) => update({ status: status as SupplierFilters["status"] })}
        value={filters.status}
      >
        <SelectTrigger aria-label="Filter by supplier status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
        </SelectContent>
      </Select>
      <Input
        aria-label="Filter by country"
        onChange={(event) => update({ country: event.target.value })}
        placeholder="Country"
        value={filters.country}
      />
      <Button
        onClick={() =>
          onFiltersChange({
            search: "",
            supplierCategoryId: "all",
            status: "all",
            country: "",
          })
        }
        type="button"
        variant="outline"
      >
        Reset
      </Button>
    </div>
  );
}
