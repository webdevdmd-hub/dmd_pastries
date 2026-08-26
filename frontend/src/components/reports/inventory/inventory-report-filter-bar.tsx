"use client";

import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";
import type { InventoryReportFilters, InventoryReportItemType } from "@/types/inventory-reports";

const allValue = "all";

export type InventoryReportSelectOption = {
  label: string;
  value: string;
};

const defaultStatusOptions: InventoryReportSelectOption[] = [
  { label: "All statuses", value: allValue },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Low stock", value: "low_stock" },
  { label: "Out of stock", value: "out_of_stock" },
];

function isExpiryState(value: string): value is NonNullable<InventoryReportFilters["expiryState"]> {
  return value === "expired" || value === "expires_today" || value === "expiring_soon";
}

export type InventoryReportFilterDraft = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  itemType: "all" | InventoryReportItemType;
  status: string;
};

export function toInventoryReportFilters(
  filters: InventoryReportFilterDraft,
  statusFilterKey: "expiryState" | "status" = "status",
): InventoryReportFilters {
  const statusFilter =
    filters.status !== allValue
      ? statusFilterKey === "expiryState" && isExpiryState(filters.status)
        ? { expiryState: filters.status }
        : statusFilterKey === "status"
          ? { status: filters.status }
          : {}
      : {};

  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.itemType !== allValue ? { itemType: filters.itemType } : {}),
    ...statusFilter,
  };
}

export function InventoryReportFilterBar({
  branches,
  canAccessAllBranches,
  currentBranchId,
  defaultFilters,
  filters,
  onApply,
  onChange,
  onReset,
  statusOptions = defaultStatusOptions,
}: {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  defaultFilters: InventoryReportFilterDraft;
  filters: InventoryReportFilterDraft;
  onApply: () => void;
  onChange: (filters: InventoryReportFilterDraft) => void;
  onReset: () => void;
  statusOptions?: InventoryReportSelectOption[];
}): JSX.Element {
  return (
    <Card className="bg-card/85 shadow-soft">
      <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
        <ReportBranchSelect
          branches={branches}
          canAccessAllBranches={canAccessAllBranches}
          currentBranchId={currentBranchId}
          value={filters.branchId}
          onChange={(branchId) => onChange({ ...filters, branchId })}
        />
        <div className="space-y-2">
          <label
            htmlFor="inventory-report-filter-bar-item-type"
            className="text-sm font-medium text-brand-espresso"
          >
            Item type
          </label>
          <Select
            value={filters.itemType}
            onValueChange={(itemType: InventoryReportFilterDraft["itemType"]) =>
              onChange({ ...filters, itemType })
            }
          >
            <SelectTrigger id="inventory-report-filter-bar-item-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All item types</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="product_variant">Variants</SelectItem>
              <SelectItem value="ingredient">Ingredients</SelectItem>
              <SelectItem value="packaging">Packaging</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="inventory-report-filter-bar-status"
            className="text-sm font-medium text-brand-espresso"
          >
            Status
          </label>
          <Select
            value={filters.status}
            onValueChange={(status) => onChange({ ...filters, status })}
          >
            <SelectTrigger id="inventory-report-filter-bar-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ReportDateRangePicker
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onDateFromChange={(dateFrom) => onChange({ ...filters, dateFrom })}
          onDateToChange={(dateTo) => onChange({ ...filters, dateTo })}
        />
        <div className="flex items-end gap-2 xl:col-span-6">
          <Button type="button" onClick={onApply}>
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onChange(defaultFilters);
              onReset();
            }}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
