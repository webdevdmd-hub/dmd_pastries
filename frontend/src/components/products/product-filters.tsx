"use client";

import type { JSX } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductListFilters, ProductType } from "@/types/product";

type ProductFiltersProps = {
  categories: { id: string; categoryName: string }[];
  filters: ProductListFilters;
  onFiltersChange: (filters: ProductListFilters) => void;
};

const productTypes: ProductType[] = [
  "ready_to_sell",
  "made_to_order",
  "manufactured",
  "retail",
  "service",
];

export function ProductFilters({
  categories,
  filters,
  onFiltersChange,
}: ProductFiltersProps): JSX.Element {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div className="space-y-1">
        <Label htmlFor="products-search">Search</Label>
        <Input
          id="products-search"
          onChange={(event) => onFiltersChange({ ...filters, page: 1, search: event.target.value })}
          placeholder="Search by name, code, SKU..."
          value={filters.search}
        />
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select
          onValueChange={(value) => onFiltersChange({ ...filters, page: 1, categoryId: value })}
          value={filters.categoryId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
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
      </div>
      <div className="space-y-1">
        <Label>Type</Label>
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              page: 1,
              productType: value as ProductListFilters["productType"],
            })
          }
          value={filters.productType}
        >
          <SelectTrigger>
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {productTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select
          onValueChange={(value) =>
            onFiltersChange({ ...filters, page: 1, status: value as ProductListFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>POS Visible</Label>
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              page: 1,
              isPosVisible: value as ProductListFilters["isPosVisible"],
            })
          }
          value={filters.isPosVisible}
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
