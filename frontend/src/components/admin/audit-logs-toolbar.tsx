"use client";

import type { JSX } from "react";
import { useMemo } from "react";

import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/types/user";

export type AuditLogFilters = {
  dateFrom: string;
  dateTo: string;
  entityType: string;
  userId: string;
};

export const defaultAuditLogFilters: AuditLogFilters = {
  dateFrom: "",
  dateTo: "",
  entityType: "all",
  userId: "",
};

function countHiddenFilters(filters: AuditLogFilters): number {
  let count = 0;
  if (filters.entityType !== "all") count += 1;
  if (filters.userId.length > 0) count += 1;
  if (filters.dateFrom.length > 0) count += 1;
  if (filters.dateTo.length > 0) count += 1;
  return count;
}

/**
 * One toolbar for one stream.
 *
 * The page used to be two cards with duplicated date controls, and seeing one
 * person's history meant pasting their UUID into a text box. Who is now a
 * picker like every other lookup in the app.
 */
export function AuditLogsToolbar({
  entityOptions,
  filters,
  isUsersLoading,
  onFiltersChange,
  timezone,
  users,
}: {
  entityOptions: { label: string; value: string }[];
  filters: AuditLogFilters;
  isUsersLoading: boolean;
  onFiltersChange: (filters: AuditLogFilters) => void;
  timezone: string;
  users: User[];
}): JSX.Element {
  const hiddenFilterCount = countHiddenFilters(filters);
  const userOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      users.map((user) => ({
        description: user.email,
        keywords: [user.fullName, user.email, user.roleName],
        label: user.fullName,
        value: user.id,
      })),
    [users],
  );

  return (
    <FilterToolbar
      hasAnyFilter={hiddenFilterCount > 0}
      hiddenFilterCount={hiddenFilterCount}
      hideDensityBelowMd
      onReset={() => onFiltersChange(defaultAuditLogFilters)}
      popoverTitle="Filter activity"
    >
      <FilterField htmlFor="auditFilterModule" label="Module">
        <Select
          onValueChange={(entityType) => onFiltersChange({ ...filters, entityType })}
          value={filters.entityType}
        >
          <SelectTrigger id="auditFilterModule">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            {entityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField htmlFor="auditFilterUser" label="User">
        <SearchableCombobox
          emptyMessage="No staff user matches."
          id="auditFilterUser"
          isLoading={isUsersLoading}
          onValueChange={(userId) => onFiltersChange({ ...filters, userId })}
          options={userOptions}
          placeholder="Anyone"
          searchPlaceholder="Search staff by name or email..."
          value={filters.userId}
        />
      </FilterField>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <FilterField htmlFor="auditFilterDateFrom" label="From">
          <Input
            id="auditFilterDateFrom"
            onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </FilterField>
        <FilterField htmlFor="auditFilterDateTo" label="To">
          <Input
            id="auditFilterDateTo"
            onChange={(event) => onFiltersChange({ ...filters, dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </FilterField>
      </div>

      {/* Dates are read in the business timezone, and a log read in the wrong
          one is a log that disagrees with everyone's memory of the day. */}
      <p className="text-meta text-foreground-muted">Times shown in {timezone}.</p>
    </FilterToolbar>
  );
}
