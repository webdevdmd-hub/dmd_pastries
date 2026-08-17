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
import type { CustomerFilters, CustomerTag } from "@/types/customer";

type CustomersToolbarProps = {
  filters: CustomerFilters;
  onFiltersChange: (filters: CustomerFilters) => void;
  tags: CustomerTag[];
};

export function CustomersToolbar({
  filters,
  onFiltersChange,
  tags,
}: CustomersToolbarProps): JSX.Element {
  const update = (patch: Partial<CustomerFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-card/75 p-4 shadow-soft lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
      <Input
        aria-label="Search customers"
        onChange={(event) => update({ search: event.target.value })}
        placeholder="Search name, phone, email..."
        value={filters.search}
      />
      <Select
        onValueChange={(status) => update({ status: status as CustomerFilters["status"] })}
        value={filters.status}
      >
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
        </SelectContent>
      </Select>
      <Select onValueChange={(tagId) => update({ tagId })} value={filters.tagId}>
        <SelectTrigger aria-label="Filter by tag">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.tagName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        aria-label="Customers date from"
        onChange={(event) => update({ dateFrom: event.target.value })}
        type="date"
        value={filters.dateFrom}
      />
      <Input
        aria-label="Customers date to"
        onChange={(event) => update({ dateTo: event.target.value })}
        type="date"
        value={filters.dateTo}
      />
      <Button
        onClick={() =>
          onFiltersChange({ search: "", status: "all", tagId: "all", dateFrom: "", dateTo: "" })
        }
        type="button"
        variant="outline"
      >
        Reset
      </Button>
    </div>
  );
}
