"use client";

import { RotateCcw } from "lucide-react";
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
  status: "all",
  isPosVisible: "all",
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
    <Card>
      <CardContent className="space-y-4 p-4">
        <ProductFilters
          categories={categories}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
        <div className="flex justify-end">
          <Button onClick={() => onFiltersChange(defaultFilters)} type="button" variant="outline">
            <RotateCcw className="h-4 w-4" />
            Reset filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
