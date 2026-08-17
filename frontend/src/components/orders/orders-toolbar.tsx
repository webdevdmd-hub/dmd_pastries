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
import type { BakeryOrderFilters } from "@/types/orders";

const defaultFilters: BakeryOrderFilters = {
  dateFrom: "",
  dateTo: "",
  orderType: "all",
  search: "",
  status: "all",
};

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

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino/60 bg-card/80 p-4 lg:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
      <Input
        aria-label="Search orders"
        onChange={(event) => update({ search: event.target.value })}
        placeholder="Search order number, customer..."
        value={filters.search}
      />
      <Select
        onValueChange={(status) => update({ status: status as BakeryOrderFilters["status"] })}
        value={filters.status}
      >
        <SelectTrigger>
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
      <Select
        onValueChange={(orderType) =>
          update({ orderType: orderType as BakeryOrderFilters["orderType"] })
        }
        value={filters.orderType}
      >
        <SelectTrigger>
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="pickup">Pickup</SelectItem>
          <SelectItem value="delivery">Delivery</SelectItem>
        </SelectContent>
      </Select>
      <Input
        aria-label="Date from"
        onChange={(event) => update({ dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        aria-label="Date to"
        onChange={(event) => update({ dateTo: event.target.value })}
        type="date"
        value={filters.dateTo}
      />
      <Button onClick={() => onFiltersChange(defaultFilters)} type="button" variant="outline">
        Reset
      </Button>
    </div>
  );
}
