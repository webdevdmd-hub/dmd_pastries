"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
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

type ProductsToolbarProps = {
  categories: { id: string; categoryName: string }[];
  filters: ProductListFilters;
  onFiltersChange: (filters: ProductListFilters) => void;
};

const defaultFilters: ProductListFilters = {
  search: "",
  categoryId: "all",
  productType: "all",
  itemStructure: "all",
  status: "all",
  isPosVisible: "all",
  isSellable: "all",
  isPurchasable: "all",
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "desc",
};

const YES_NO_FILTERS = [
  { key: "isSellable", label: "Sellable" },
  { key: "isPosVisible", label: "POS visible" },
] as const;

/**
 * Search stays in the toolbar; everything else lives in the Filters popover,
 * the same idiom as the other lists. Sort and page size sit at the bottom of
 * the popover but never count toward the badge: they change the order and
 * the page, not which products qualify.
 */
export function ProductsToolbar({
  categories,
  filters,
  onFiltersChange,
}: ProductsToolbarProps): JSX.Element {
  // Every change returns to page 1: page 3 of the old result set is rarely
  // page 3 of the new one.
  const update = (patch: Partial<ProductListFilters>): void => {
    onFiltersChange({ ...filters, ...patch, page: 1 });
  };

  const hiddenFilterCount =
    (filters.categoryId !== defaultFilters.categoryId ? 1 : 0) +
    (filters.status !== defaultFilters.status ? 1 : 0) +
    (filters.productType !== defaultFilters.productType ? 1 : 0) +
    (filters.itemStructure !== defaultFilters.itemStructure ? 1 : 0) +
    (filters.isSellable !== defaultFilters.isSellable ? 1 : 0) +
    (filters.isPosVisible !== defaultFilters.isPosVisible ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange({ ...defaultFilters, limit: filters.limit })}
      onSearchChange={(search) => update({ search })}
      popoverTitle="Filter products"
      searchAriaLabel="Search products"
      searchPlaceholder="Search name, code, SKU, barcode..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="productsFilterCategory" label="Category">
        <Select onValueChange={(categoryId) => update({ categoryId })} value={filters.categoryId}>
          <SelectTrigger id="productsFilterCategory">
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
      </FilterField>

      <FilterField htmlFor="productsFilterStatus" label="Status">
        <Select
          onValueChange={(status) => update({ status: status as ProductListFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id="productsFilterStatus">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-3">
        <FilterField htmlFor="productsFilterType" label="Type">
          <Select
            onValueChange={(productType) =>
              update({ productType: productType as ProductListFilters["productType"] })
            }
            value={filters.productType}
          >
            <SelectTrigger id="productsFilterType">
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
        </FilterField>
        <FilterField htmlFor="productsFilterStructure" label="Structure">
          <Select
            onValueChange={(itemStructure) =>
              update({ itemStructure: itemStructure as ProductListFilters["itemStructure"] })
            }
            value={filters.itemStructure}
          >
            <SelectTrigger id="productsFilterStructure">
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
        </FilterField>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {YES_NO_FILTERS.map((item) => (
          <FilterField htmlFor={`productsFilter-${item.key}`} key={item.key} label={item.label}>
            <Select
              onValueChange={(value) => update({ [item.key]: value as "all" | "true" | "false" })}
              value={filters[item.key]}
            >
              <SelectTrigger id={`productsFilter-${item.key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <FilterField htmlFor="productsFilterSort" label="Sort">
          <Select
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split(":");
              update({
                sortBy: sortBy as ProductListFilters["sortBy"],
                sortOrder: sortOrder as ProductListFilters["sortOrder"],
              });
            }}
            value={`${filters.sortBy}:${filters.sortOrder}`}
          >
            <SelectTrigger id="productsFilterSort">
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
        </FilterField>
        <FilterField htmlFor="productsFilterRows" label="Rows per page">
          <Select
            onValueChange={(value) => update({ limit: Number(value) })}
            value={String(filters.limit)}
          >
            <SelectTrigger id="productsFilterRows">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="20">20 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
