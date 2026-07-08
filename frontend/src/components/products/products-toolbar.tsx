"use client";

import { Filter, RotateCcw } from "lucide-react";
import type { JSX } from "react";

import { ProductFilters } from "@/components/products/product-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const activeFilterCount = [
    filters.search.trim().length > 0,
    filters.categoryId !== "all",
    filters.productType !== "all",
    filters.itemStructure !== "all",
    filters.status !== "all",
    filters.isPosVisible !== "all",
    filters.isSellable !== "all",
    filters.isPurchasable !== "all",
  ].filter(Boolean).length;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-brand-cappuccino/70 bg-brand-latte/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-espresso">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-brand-mocha">
              <Filter className="h-4 w-4" />
            </span>
            Catalog filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-brand-caramel/15 px-2 py-0.5 text-xs text-brand-mocha">
                {activeFilterCount} active
              </span>
            ) : null}
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => onFiltersChange(defaultFilters)}
            type="button"
            variant="outline"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
        <div className="p-4">
          <ProductFilters
            categories={categories}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
