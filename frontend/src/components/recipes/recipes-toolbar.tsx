"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RecipeFilters, RecipeProductOption } from "@/types/recipes";

type RecipesToolbarProps = {
  filters: RecipeFilters;
  onFiltersChange: (filters: RecipeFilters) => void;
  products: RecipeProductOption[];
};

const resetFilters: RecipeFilters = {
  active: "all",
  productId: "all",
  search: "",
  status: "all",
};

/** Search is visible in the toolbar, so it does not count toward the badge. */
function countHiddenFilters(filters: RecipeFilters): number {
  let count = 0;
  if (filters.productId !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.active !== "all") count += 1;
  return count;
}

export function RecipesToolbar({
  filters,
  onFiltersChange,
  products,
}: RecipesToolbarProps): JSX.Element {
  const update = (patch: Partial<RecipeFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  const hiddenFilterCount = countHiddenFilters(filters);

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(resetFilters)}
      onSearchChange={(search) => update({ search })}
      popoverTitle="Filter recipes"
      searchAriaLabel="Search recipes"
      searchPlaceholder="Search recipe, code, product..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="recipeFilterProduct" label="Product">
        <Select onValueChange={(productId) => update({ productId })} value={filters.productId}>
          <SelectTrigger id="recipeFilterProduct">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.productName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="recipeFilterStatus" label="Status">
        <Select
          onValueChange={(status) => update({ status: status as RecipeFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id="recipeFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      {/* Status and "active BOM" are different questions: a recipe can be
          status-active and still not be the BOM manufacturing uses. */}
      <label className="flex items-center gap-2.5 border-t border-border pt-3 text-cell font-medium">
        <Checkbox
          checked={filters.active === "true"}
          onCheckedChange={(checked) => update({ active: checked === true ? "true" : "all" })}
        />
        Active BOM only
      </label>
    </FilterToolbar>
  );
}
