"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";
import type { InventoryFilters } from "@/types/inventory";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";

type InventoryToolbarProps = {
  allowAllBranches?: boolean;
  branches: Branch[];
  filters: InventoryFilters;
  onFiltersChange: (filters: InventoryFilters) => void;
  resetBranchId: string;
};

export function InventoryToolbar({
  allowAllBranches = true,
  branches,
  filters,
  onFiltersChange,
  resetBranchId,
}: InventoryToolbarProps): JSX.Element {
  const updateFilters = (nextFilters: Partial<InventoryFilters>): void => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-card/70 p-4 shadow-soft lg:grid-cols-[1.3fr_repeat(4,1fr)_auto]">
      <Input
        aria-label="Search inventory"
        onChange={(event) => updateFilters({ search: event.target.value })}
        placeholder="Search item, code..."
        value={filters.search}
      />
      <Select onValueChange={(branchId) => updateFilters({ branchId })} value={filters.branchId}>
        <SelectTrigger>
          <SelectValue placeholder="Branch" />
        </SelectTrigger>
        <SelectContent>
          {allowAllBranches ? <SelectItem value="all">All branches</SelectItem> : null}
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(itemType) =>
          updateFilters({ itemType: itemType as InventoryFilters["itemType"] })
        }
        value={filters.itemType}
      >
        <SelectTrigger>
          <SelectValue placeholder="Item type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All item types</SelectItem>
          <SelectItem value="product">Products</SelectItem>
          <SelectItem value="product_variant">Variants</SelectItem>
        </SelectContent>
      </Select>
      <Select
        onValueChange={(productType) =>
          updateFilters({ productType: productType as InventoryFilters["productType"] })
        }
        value={filters.productType}
      >
        <SelectTrigger>
          <SelectValue placeholder="Product type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All product types</SelectItem>
          {PRODUCT_TYPES.map((productType) => (
            <SelectItem key={productType} value={productType}>
              {PRODUCT_TYPE_LABELS[productType]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(status) => updateFilters({ status: status as InventoryFilters["status"] })}
        value={filters.status}
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button
        onClick={() =>
          onFiltersChange({
            search: "",
            branchId: resetBranchId,
            itemType: "all",
            productType: "all",
            status: "all",
            lowStockOnly: false,
            expiryTrackedOnly: false,
            includeUninitialized: false,
          })
        }
        type="button"
        variant="outline"
      >
        Reset
      </Button>
      <div className="flex flex-wrap items-center gap-4 lg:col-span-6">
        <label className="flex items-center gap-2 text-sm text-brand-mocha">
          <Checkbox
            checked={filters.lowStockOnly}
            onCheckedChange={(checked) => updateFilters({ lowStockOnly: checked === true })}
          />
          Low stock only
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-mocha">
          <Checkbox
            checked={filters.expiryTrackedOnly}
            onCheckedChange={(checked) => updateFilters({ expiryTrackedOnly: checked === true })}
          />
          Expiry tracked
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-mocha">
          <Checkbox
            checked={filters.includeUninitialized}
            onCheckedChange={(checked) => updateFilters({ includeUninitialized: checked === true })}
          />
          Include catalog items without stock
        </label>
        <Label className="sr-only">Inventory filters</Label>
      </div>
    </div>
  );
}
