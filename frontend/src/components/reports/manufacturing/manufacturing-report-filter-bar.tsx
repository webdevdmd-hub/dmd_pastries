"use client";

import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import {
  compactSummary,
  countReportFilterChanges,
  describeReportBranch,
  describeReportChoice,
  describeReportPeriod,
  ReportFilterPopover,
} from "@/components/reports/report-filter-popover";
import { ReportPresetSelector } from "@/components/reports/report-preset-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useProductPicker } from "@/hooks/use-lookups";
import { useRecipes } from "@/hooks/use-recipes";
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

const batchStatusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "In progress", value: "in_progress" },
  { label: "Partially completed", value: "partially_completed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

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
  const products = useProductPicker({ limit: 200 }).data?.items ?? [];
  const recipes =
    useRecipes({ active: "all", productId: "", search: "", status: "all" }).data ?? [];

  const setPreset = (datePreset: ReportDatePreset): void => {
    if (datePreset === "custom") {
      onChange({ ...filters, datePreset });
      return;
    }
    onChange({ ...filters, ...resolveReportPresetRange(datePreset), datePreset });
  };

  return (
    <ReportFilterPopover
      changedCount={countReportFilterChanges(filters, defaultFilters)}
      draftKey={JSON.stringify(filters)}
      onApply={onApply}
      onReset={() => {
        onChange(defaultFilters);
        onReset();
      }}
      popoverTitle="Filter manufacturing report"
      summary={compactSummary([
        describeReportPeriod(filters.datePreset, filters.dateFrom, filters.dateTo),
        describeReportBranch(branches, filters.branchId),
        `By ${filters.groupBy}`,
        describeReportChoice(filters.batchStatus, defaultFilters.batchStatus, batchStatusOptions),
        filters.productId ? "Product set" : null,
        filters.recipeId ? "Recipe set" : null,
      ])}
    >
      <>
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
        {/* Lists, not ID boxes. Both of these asked for a UUID, which appears
            nowhere in the app, so neither filter could be used without reading
            the database. Same defect as ISSUE-015 on the Payments page.

            Regression: ISSUE-016 — report filters asked for UUIDs no operator can see
            Found by /qa on 2026-09-15 */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-brand-espresso"
            htmlFor="manufacturing-product-id"
          >
            Product
          </label>
          <Select
            onValueChange={(value) =>
              onChange({ ...filters, productId: value === allValue ? "" : value })
            }
            value={filters.productId || allValue}
          >
            <SelectTrigger id="manufacturing-product-id">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allValue}>All products</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.productName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-brand-espresso"
            htmlFor="manufacturing-recipe-id"
          >
            Recipe
          </label>
          <Select
            onValueChange={(value) =>
              onChange({ ...filters, recipeId: value === allValue ? "" : value })
            }
            value={filters.recipeId || allValue}
          >
            <SelectTrigger id="manufacturing-recipe-id">
              <SelectValue placeholder="All recipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allValue}>All recipes</SelectItem>
              {recipes.map((recipe) => (
                <SelectItem key={recipe.id} value={recipe.id}>
                  {recipe.recipeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </>
    </ReportFilterPopover>
  );
}
