"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";
import type { StockMovementFilters } from "@/types/stock-movements";

type MovementsToolbarProps = {
  allowAllBranches?: boolean;
  branches: Branch[];
  filters: StockMovementFilters;
  onFiltersChange: (filters: StockMovementFilters) => void;
  resetBranchId: string;
};

export function MovementsToolbar({
  allowAllBranches = true,
  branches,
  filters,
  onFiltersChange,
  resetBranchId,
}: MovementsToolbarProps): JSX.Element {
  const updateFilters = (nextFilters: Partial<StockMovementFilters>): void => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-card/70 p-4 shadow-soft lg:grid-cols-4 xl:grid-cols-9">
      <Input
        aria-label="Search stock movements"
        onChange={(event) => updateFilters({ search: event.target.value })}
        placeholder="Search item, reference..."
        value={filters.search}
      />
      <Select onValueChange={(branchId) => updateFilters({ branchId })} value={filters.branchId}>
        <SelectTrigger>
          <SelectValue />
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
          updateFilters({ itemType: itemType as StockMovementFilters["itemType"] })
        }
        value={filters.itemType}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All item types</SelectItem>
          <SelectItem value="product">Products</SelectItem>
          <SelectItem value="product_variant">Variants</SelectItem>
        </SelectContent>
      </Select>
      <Select
        onValueChange={(productType) =>
          updateFilters({ productType: productType as StockMovementFilters["productType"] })
        }
        value={filters.productType}
      >
        <SelectTrigger>
          <SelectValue />
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
        onValueChange={(movementType) =>
          updateFilters({ movementType: movementType as StockMovementFilters["movementType"] })
        }
        value={filters.movementType}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All movements</SelectItem>
          <SelectItem value="opening_stock">Opening Stock</SelectItem>
          <SelectItem value="purchase_in">Purchase In</SelectItem>
          <SelectItem value="sale_out">Sale Out</SelectItem>
          <SelectItem value="adjustment_in">Adjustment In</SelectItem>
          <SelectItem value="adjustment_out">Adjustment Out</SelectItem>
          <SelectItem value="wastage">Wastage</SelectItem>
          <SelectItem value="return_in">Return In</SelectItem>
          <SelectItem value="transfer">Stock Transfer</SelectItem>
          <SelectItem value="transfer_in">Transfer In</SelectItem>
          <SelectItem value="transfer_out">Transfer Out</SelectItem>
          <SelectItem value="production_in">Production In</SelectItem>
          <SelectItem value="production_out">Production Out</SelectItem>
          <SelectItem value="purchase_return_out">Vendor Credit</SelectItem>
          <SelectItem value="purchase_bill_cancel_out">Purchase Cancellation</SelectItem>
          <SelectItem value="reversal">Reversal</SelectItem>
        </SelectContent>
      </Select>
      <Select
        onValueChange={(direction) =>
          updateFilters({ direction: direction as StockMovementFilters["direction"] })
        }
        value={filters.direction}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All directions</SelectItem>
          <SelectItem value="in">In</SelectItem>
          <SelectItem value="out">Out</SelectItem>
          <SelectItem value="transfer">Transfer</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
        </SelectContent>
      </Select>
      <Input
        aria-label="Date from"
        onChange={(event) => updateFilters({ dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        aria-label="Date to"
        onChange={(event) => updateFilters({ dateTo: event.target.value })}
        type="date"
        value={filters.dateTo}
      />
      <Button
        onClick={() =>
          onFiltersChange({
            search: "",
            branchId: resetBranchId,
            itemType: "all",
            productType: "all",
            movementType: "all",
            direction: "all",
            dateFrom: "",
            dateTo: "",
            createdBy: "",
          })
        }
        type="button"
        variant="outline"
      >
        Reset
      </Button>
      <Input
        aria-label="Created by"
        className="lg:col-span-2"
        onChange={(event) => updateFilters({ createdBy: event.target.value })}
        placeholder="Created by user..."
        value={filters.createdBy}
      />
    </div>
  );
}
