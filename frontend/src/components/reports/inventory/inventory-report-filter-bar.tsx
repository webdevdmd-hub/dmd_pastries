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

export type InventoryReportFilterDraft = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  itemType: "all" | InventoryReportItemType;
  status: string;
};

export function toInventoryReportFilters(
  filters: InventoryReportFilterDraft,
): InventoryReportFilters {
  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.itemType !== allValue ? { itemType: filters.itemType } : {}),
    ...(filters.status !== allValue ? { status: filters.status } : {}),
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
}: {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  defaultFilters: InventoryReportFilterDraft;
  filters: InventoryReportFilterDraft;
  onApply: () => void;
  onChange: (filters: InventoryReportFilterDraft) => void;
  onReset: () => void;
}): JSX.Element {
  return (
    <Card className="bg-white/85 shadow-soft">
      <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
        <ReportBranchSelect
          branches={branches}
          canAccessAllBranches={canAccessAllBranches}
          currentBranchId={currentBranchId}
          value={filters.branchId}
          onChange={(branchId) => onChange({ ...filters, branchId })}
        />
        <div className="space-y-2">
          <label className="text-sm font-medium text-brand-espresso">Item type</label>
          <Select
            value={filters.itemType}
            onValueChange={(itemType: InventoryReportFilterDraft["itemType"]) =>
              onChange({ ...filters, itemType })
            }
          >
            <SelectTrigger>
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
          <label className="text-sm font-medium text-brand-espresso">Status</label>
          <Select
            value={filters.status}
            onValueChange={(status) => onChange({ ...filters, status })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="low_stock">Low stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
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
