"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PackagingCategory,
  PackagingFilters,
  PackagingSupplierOption,
} from "@/types/packaging";

type PackagingToolbarProps = {
  categories: PackagingCategory[];
  filters: PackagingFilters;
  onFiltersChange: (filters: PackagingFilters) => void;
  suppliers: PackagingSupplierOption[];
};

export function PackagingToolbar({
  categories,
  filters,
  onFiltersChange,
  suppliers,
}: PackagingToolbarProps): JSX.Element {
  const update = (patch: Partial<PackagingFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-card/75 p-4 shadow-soft xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]">
      <Input
        aria-label="Search packaging"
        onChange={(event) => update({ search: event.target.value })}
        placeholder="Search packaging, code..."
        value={filters.search}
      />
      <Select onValueChange={(categoryId) => update({ categoryId })} value={filters.categoryId}>
        <SelectTrigger aria-label="Filter by packaging category">
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
      <Select onValueChange={(supplierId) => update({ supplierId })} value={filters.supplierId}>
        <SelectTrigger aria-label="Filter by supplier">
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
      <Select
        onValueChange={(status) => update({ status: status as PackagingFilters["status"] })}
        value={filters.status}
      >
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm font-medium text-brand-espresso">
        <Checkbox
          checked={filters.stockTracked === "true"}
          onCheckedChange={(checked) => update({ stockTracked: checked === true ? "true" : "all" })}
        />
        Stock tracked
      </label>
      <Button
        onClick={() =>
          onFiltersChange({
            search: "",
            categoryId: "all",
            supplierId: "all",
            status: "all",
            stockTracked: "all",
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
