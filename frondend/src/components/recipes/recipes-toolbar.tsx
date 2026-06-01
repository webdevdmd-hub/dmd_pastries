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
import type { RecipeFilters, RecipeProductOption } from "@/types/recipes";

type RecipesToolbarProps = {
  filters: RecipeFilters;
  onFiltersChange: (filters: RecipeFilters) => void;
  products: RecipeProductOption[];
};

export function RecipesToolbar({
  filters,
  onFiltersChange,
  products,
}: RecipesToolbarProps): JSX.Element {
  const update = (patch: Partial<RecipeFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-white/75 p-4 shadow-soft xl:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
      <Input
        aria-label="Search recipes"
        onChange={(event) => update({ search: event.target.value })}
        placeholder="Search recipe, code, product..."
        value={filters.search}
      />
      <Select onValueChange={(productId) => update({ productId })} value={filters.productId}>
        <SelectTrigger aria-label="Filter by product">
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
      <Select
        onValueChange={(status) => update({ status: status as RecipeFilters["status"] })}
        value={filters.status}
      >
        <SelectTrigger aria-label="Filter by status">
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
      <label className="flex items-center gap-2 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm font-medium text-brand-espresso">
        <Checkbox
          checked={filters.active === "true"}
          onCheckedChange={(checked) => update({ active: checked === true ? "true" : "all" })}
        />
        Active only
      </label>
      <Button
        onClick={() =>
          onFiltersChange({ active: "all", productId: "all", search: "", status: "all" })
        }
        type="button"
        variant="outline"
      >
        Reset
      </Button>
    </div>
  );
}
