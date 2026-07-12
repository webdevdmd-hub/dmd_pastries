"use client";

import type { JSX } from "react";

import { ProductFilters } from "@/components/products/product-filters";
import type { ProductListFilters } from "@/types/product";

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

export function ProductsToolbar({
  categories,
  filters,
  onFiltersChange,
}: ProductsToolbarProps): JSX.Element {
  return (
    <div className="rounded-3xl border border-brand-cappuccino bg-white/75 p-4 shadow-soft">
      <ProductFilters
        categories={categories}
        defaultFilters={defaultFilters}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </div>
  );
}
