"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_STRUCTURE_LABELS,
  ITEM_STRUCTURES,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPES,
  type ProductListFilters,
} from "@/types/product";

type ProductFiltersProps = {
  categories: { id: string; categoryName: string }[];
  defaultFilters: ProductListFilters;
  filters: ProductListFilters;
  onFiltersChange: (filters: ProductListFilters) => void;
};

export function ProductFilters({
  categories,
  defaultFilters,
  filters,
  onFiltersChange,
}: ProductFiltersProps): JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <Input
          aria-label="Search products"
          onChange={(event) => onFiltersChange({ ...filters, page: 1, search: event.target.value })}
          placeholder="Search name, code, SKU, barcode..."
          value={filters.search}
        />

        <div>
          <Select
            onValueChange={(value) => onFiltersChange({ ...filters, categoryId: value, page: 1 })}
            value={filters.categoryId}
          >
            <SelectTrigger aria-label="Filter by category">
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
          <Select
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                page: 1,
                status: value as ProductListFilters["status"],
              })
            }
            value={filters.status}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full lg:w-auto"
          onClick={() => setAdvancedOpen((current) => !current)}
          type="button"
          variant="outline"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedOpen ? "Fewer filters" : "More filters"}
        </Button>
        <Button
          className="w-full lg:w-auto"
          onClick={() => onFiltersChange(defaultFilters)}
          type="button"
          variant="outline"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {advancedOpen ? (
        <div className="grid gap-3 border-t border-brand-cappuccino/70 pt-3 sm:grid-cols-2 xl:grid-cols-7">
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {PRODUCT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PRODUCT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Structure</Label>
            <Select
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  itemStructure: value as ProductListFilters["itemStructure"],
                  page: 1,
                })
              }
              value={filters.itemStructure}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All structures</SelectItem>
                {ITEM_STRUCTURES.map((itemStructure) => (
                  <SelectItem key={itemStructure} value={itemStructure}>
                    {ITEM_STRUCTURE_LABELS[itemStructure]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {[
            { key: "isSellable", label: "Sellable" },
            { key: "isPosVisible", label: "POS visible" },
            { key: "isPurchasable", label: "Purchasable" },
          ].map((item) => (
            <div key={item.key}>
              <Label>{item.label}</Label>
              <Select
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    [item.key]: value,
                    page: 1,
                  })
                }
                value={filters[item.key as "isPosVisible" | "isPurchasable" | "isSellable"]}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}

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
              onValueChange={(value) =>
                onFiltersChange({ ...filters, limit: Number(value), page: 1 })
              }
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
      ) : null}
    </div>
  );
}
