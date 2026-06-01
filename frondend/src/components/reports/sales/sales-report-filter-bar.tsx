"use client";

import type { JSX } from "react";

import { ReportFilterBar, type ReportFilterDraft } from "@/components/reports/report-filter-bar";
import type { Branch } from "@/types/branch";
import type { SalesReportFilters, SalesReportGroupBy } from "@/types/sales-reports";

export type SalesReportFilterDraft = ReportFilterDraft;

function isSalesGroupBy(value: string): value is SalesReportGroupBy {
  return value === "day" || value === "week" || value === "month";
}

export function toSalesReportFilters(
  filters: SalesReportFilterDraft,
  timezone: string,
): SalesReportFilters {
  return {
    ...(filters.branchId === "all"
      ? { branchId: "all" }
      : filters.branchId
        ? { branchId: filters.branchId }
        : {}),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    ...(isSalesGroupBy(filters.groupBy) ? { groupBy: filters.groupBy } : {}),
    timezone,
  };
}

export function SalesReportFilterBar({
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
  defaultFilters: SalesReportFilterDraft;
  filters: SalesReportFilterDraft;
  onApply: () => void;
  onChange: (filters: SalesReportFilterDraft) => void;
  onReset: () => void;
}): JSX.Element {
  return (
    <ReportFilterBar
      branches={branches}
      canAccessAllBranches={canAccessAllBranches}
      currentBranchId={currentBranchId}
      defaultFilters={defaultFilters}
      filters={filters}
      onApply={onApply}
      onChange={onChange}
      onReset={onReset}
    />
  );
}
