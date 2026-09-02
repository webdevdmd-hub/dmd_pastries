"use client";

import type { JSX } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BakeryOrderFilters } from "@/types/orders";

const defaultFilters: BakeryOrderFilters = {
  dateFrom: "",
  dateTo: "",
  orderType: "all",
  search: "",
  status: "all",
};

/**
 * Search stays in the toolbar; status, type and the date range live in the
 * Filters popover, the same idiom as the Inventory module. On a phone the old
 * layout stacked all six controls before the first order came into view.
 */
export function OrdersToolbar({
  filters,
  onFiltersChange,
}: {
  filters: BakeryOrderFilters;
  onFiltersChange: (filters: BakeryOrderFilters) => void;
}): JSX.Element {
  const update = (patch: Partial<BakeryOrderFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  // Only what sits inside the popover counts toward the badge. Search is
  // visible in the toolbar and shows its own state.
  const hiddenFilterCount =
    (filters.status !== defaultFilters.status ? 1 : 0) +
    (filters.orderType !== defaultFilters.orderType ? 1 : 0) +
    (filters.dateFrom.length > 0 ? 1 : 0) +
    (filters.dateTo.length > 0 ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  return (
    <FilterToolbar
      hasAnyFilter={hasAnyFilter}
      hiddenFilterCount={hiddenFilterCount}
      onReset={() => onFiltersChange(defaultFilters)}
      onSearchChange={(search) => update({ search })}
      popoverTitle="Filter orders"
      searchAriaLabel="Search orders"
      searchPlaceholder="Search order number, customer..."
      searchValue={filters.search}
    >
      <FilterField htmlFor="ordersFilterStatus" label="Status">
        <Select
          onValueChange={(status) => update({ status: status as BakeryOrderFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id="ordersFilterStatus">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_production">In production</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="ordersFilterType" label="Order type">
        <Select
          onValueChange={(orderType) =>
            update({ orderType: orderType as BakeryOrderFilters["orderType"] })
          }
          value={filters.orderType}
        >
          <SelectTrigger id="ordersFilterType">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <div className="grid grid-cols-2 gap-3">
        <FilterField htmlFor="ordersFilterDateFrom" label="Event from">
          <Input
            id="ordersFilterDateFrom"
            onChange={(event) => update({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="ordersFilterDateTo" label="Event to">
          <Input
            id="ordersFilterDateTo"
            onChange={(event) => update({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>
    </FilterToolbar>
  );
}
