"use client";

import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { ReportPresetSelector } from "@/components/reports/report-preset-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveReportPresetRange } from "@/constants/report-presets";
import type { Branch } from "@/types/branch";
import type {
  ManufacturingReportFilters,
  ManufacturingReportGroupBy,
} from "@/types/manufacturing-reports";
import type { ReportDatePreset } from "@/types/reports";

const allValue = "all";

export type ManufacturingReportFilterDraft = {
  batchStatus: string;
  branchId: string;
  dateFrom: string;
  datePreset: ReportDatePreset;
  dateTo: string;
  groupBy: ManufacturingReportGroupBy;
  productId: string;
  recipeId: string;
};

export function toManufacturingReportFilters(
  filters: ManufacturingReportFilterDraft,
): ManufacturingReportFilters {
  return {
    ...(filters.batchStatus !== allValue ? { batchStatus: filters.batchStatus } : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    groupBy: filters.groupBy,
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.recipeId ? { recipeId: filters.recipeId } : {}),
  };
}

export function ManufacturingReportFilterBar({
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
  defaultFilters: ManufacturingReportFilterDraft;
  filters: ManufacturingReportFilterDraft;
  onApply: () => void;
  onChange: (filters: ManufacturingReportFilterDraft) => void;
  onReset: () => void;
}): JSX.Element {
  const setPreset = (datePreset: ReportDatePreset): void => {
    if (datePreset === "custom") {
      onChange({ ...filters, datePreset });
      return;
    }
    onChange({ ...filters, ...resolveReportPresetRange(datePreset), datePreset });
  };

  return (
    <Card className="bg-card/85 shadow-soft">
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5 xl:grid-cols-6">
        <ReportPresetSelector value={filters.datePreset} onChange={setPreset} />
        <ReportDateRangePicker
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onDateFromChange={(dateFrom) => onChange({ ...filters, dateFrom, datePreset: "custom" })}
          onDateToChange={(dateTo) => onChange({ ...filters, dateTo, datePreset: "custom" })}
        />
        <ReportBranchSelect
          branches={branches}
          canAccessAllBranches={canAccessAllBranches}
          currentBranchId={currentBranchId}
          value={filters.branchId}
          onChange={(branchId) => onChange({ ...filters, branchId })}
        />
        <div className="space-y-2">
          <label
            htmlFor="manufacturing-report-filter-bar-group-by"
            className="text-sm font-medium text-brand-espresso"
          >
            Group by
          </label>
          <Select
            value={filters.groupBy}
            onValueChange={(groupBy: ManufacturingReportGroupBy) =>
              onChange({ ...filters, groupBy })
            }
          >
            <SelectTrigger id="manufacturing-report-filter-bar-group-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-brand-espresso"
            htmlFor="manufacturing-product-id"
          >
            Product ID
          </label>
          <Input
            id="manufacturing-product-id"
            placeholder="Optional product UUID"
            value={filters.productId}
            onChange={(event) => onChange({ ...filters, productId: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-brand-espresso"
            htmlFor="manufacturing-recipe-id"
          >
            Recipe ID
          </label>
          <Input
            id="manufacturing-recipe-id"
            placeholder="Optional recipe UUID"
            value={filters.recipeId}
            onChange={(event) => onChange({ ...filters, recipeId: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="manufacturing-report-filter-bar-batch-status"
            className="text-sm font-medium text-brand-espresso"
          >
            Batch status
          </label>
          <Select
            value={filters.batchStatus}
            onValueChange={(batchStatus) => onChange({ ...filters, batchStatus })}
          >
            <SelectTrigger id="manufacturing-report-filter-bar-batch-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="partially_completed">Partially completed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
