"use client";

import { Search } from "lucide-react";
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <div className="md:col-span-2 xl:col-span-2">
        <Label htmlFor="products-search">Search</Label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
          <Input
            className="pl-9"
            id="products-search"
            onChange={(event) =>
              onFiltersChange({ ...filters, page: 1, search: event.target.value })
            }
            placeholder="Name, code, SKU, barcode"
            value={filters.search}
          />
        </div>
      </div>
      <div>
        <Label>Category</Label>
        <Select
          onValueChange={(value) => onFiltersChange({ ...filters, page: 1, categoryId: value })}
          value={filters.categoryId}
        >
          <SelectTrigger className="mt-1">
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
      <div>
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
          <SelectTrigger className="mt-1">
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
      <div>
        <Label>Status</Label>
        <Select
          onValueChange={(value) =>
            onFiltersChange({ ...filters, page: 1, status: value as ProductListFilters["status"] })
          }
          value={filters.status}
        >
          <SelectTrigger className="mt-1">
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
      <div>
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
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Sort</Label>
        <Select
          onValueChange={(value) => {
            const [sortBy, sortOrder] = value.split(":");

            onFiltersChange({
              ...filters,
              page: 1,
              sortBy: sortBy as ProductListFilters["sortBy"],
              sortOrder: sortOrder as ProductListFilters["sortOrder"],
            });
          }}
          value={`${filters.sortBy}:${filters.sortOrder}`}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Newest first</SelectItem>
            <SelectItem value="updated_at:desc">Recently updated</SelectItem>
            <SelectItem value="product_name:asc">Name A-Z</SelectItem>
            <SelectItem value="sale_price:asc">Price low-high</SelectItem>
            <SelectItem value="sale_price:desc">Price high-low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Rows</Label>
        <Select
          onValueChange={(value) => onFiltersChange({ ...filters, limit: Number(value), page: 1 })}
          value={String(filters.limit)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 rows</SelectItem>
            <SelectItem value="20">20 rows</SelectItem>
            <SelectItem value="50">50 rows</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
