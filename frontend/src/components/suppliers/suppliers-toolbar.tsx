"use client";

import type { JSX } from "react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SupplierFilters } from "@/types/supplier";

type SuppliersToolbarProps = {
  filters: SupplierFilters;
  onFiltersChange: (filters: SupplierFilters) => void;
};

/**
 * Every control carries a visible label.
 *
 * These were placeholder-only with an aria-label: screen readers were served,
 * but a placeholder disappears the moment you type, so a sighted user reviewing
 * a filtered list could not tell which box held "Dubai" -- the country filter
 * or the search. Labels are 12.5px muted above each field.
 */
export function SuppliersToolbar({ filters, onFiltersChange }: SuppliersToolbarProps): JSX.Element {
  const searchId = useId();
  const statusId = useId();
  const countryId = useId();

  const update = (patch: Partial<SupplierFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid min-w-[220px] flex-1 gap-1.5">
        <Label className="text-meta text-foreground-muted" htmlFor={searchId}>
          Search
        </Label>
        <Input
          id={searchId}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="Name, code, contact, phone"
          value={filters.search}
        />
      </div>

      <div className="grid w-[150px] gap-1.5">
        <Label className="text-meta text-foreground-muted" htmlFor={statusId}>
          Status
        </Label>
        <Select
          onValueChange={(status) => update({ status: status as SupplierFilters["status"] })}
          value={filters.status}
        >
          <SelectTrigger id={statusId}>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid w-[150px] gap-1.5">
        <Label className="text-meta text-foreground-muted" htmlFor={countryId}>
          Country
        </Label>
        <Input
          id={countryId}
          onChange={(event) => update({ country: event.target.value })}
          placeholder="Any"
          value={filters.country}
        />
      </div>

      <Button
        onClick={() =>
          onFiltersChange({
            search: "",
            status: "all",
            country: "",
            missingTermsOnly: false,
          })
        }
        type="button"
        variant="outline"
      >
        Reset
      </Button>
    </div>
  );
}
